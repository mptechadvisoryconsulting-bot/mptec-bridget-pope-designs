import type { SupabaseClient } from "@supabase/supabase-js";
import { toHoneyBookReferenceInsert } from "@/lib/honeybook/references";
import type {
  HoneyBookInboundEvent,
  HoneyBookInboundResult,
  HoneyBookOpenContext,
  HoneyBookOpenResult,
  HoneyBookPipelineStage,
  HoneyBookReferenceUpsertInput,
  HoneyBookService,
  HoneyBookStageContext,
  HoneyBookStageResult,
  HoneyBookFinancialReferenceResult,
} from "@/lib/integrations/honeybook/types";

type AnyClient = SupabaseClient;

const DEFAULT_HONEYBOOK_URL = "https://www.honeybook.com";

function resolveWorkspaceUrl(override?: string | null) {
  const fromOverride = override?.trim();
  if (fromOverride) return fromOverride;
  const fromEnv = process.env.HONEYBOOK_WORKSPACE_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_HONEYBOOK_URL;
}

export class ManualHoneyBookService implements HoneyBookService {
  constructor(private readonly supabase: AnyClient) {}

  async getOpenUrl(context: HoneyBookOpenContext): Promise<HoneyBookOpenResult> {
    const { data: project } = await this.supabase
      .from("projects")
      .select("id,honeybook_url")
      .eq("id", context.projectId)
      .maybeSingle();

    const url = resolveWorkspaceUrl(context.honeybookUrl ?? project?.honeybook_url ?? null);

    if (context.honeybookUrl?.trim()) {
      await this.supabase
        .from("projects")
        .update({ honeybook_url: context.honeybookUrl.trim(), updated_at: new Date().toISOString() })
        .eq("id", context.projectId);
    }

    await this.markStage("honeybook_opened", {
      projectId: context.projectId,
      actorId: context.actorId,
      note: context.note,
      metadata: { honeybook_url: url },
      source: "manual",
    });

    return { url, stage: "honeybook_opened" };
  }

  async markStage(stage: HoneyBookPipelineStage, context: HoneyBookStageContext): Promise<HoneyBookStageResult> {
    const source = context.source ?? "manual";
    const metadata = {
      ...(context.metadata ?? {}),
      ...(context.note ? { note: context.note } : {}),
    };

    const { data: project } = await this.supabase
      .from("projects")
      .select("id,lead_id")
      .eq("id", context.projectId)
      .maybeSingle();

    const leadId = context.leadId ?? project?.lead_id ?? null;

    const { error: projectError } = await this.supabase
      .from("projects")
      .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
      .eq("id", context.projectId);

    if (projectError) throw new Error(projectError.message);

    const { data: event, error: eventError } = await this.supabase
      .from("pipeline_events")
      .insert({
        project_id: context.projectId,
        lead_id: leadId,
        stage,
        source,
        actor_id: context.actorId ?? null,
        metadata,
      })
      .select("id")
      .maybeSingle();

    if (eventError) throw new Error(eventError.message);

    return { stage, eventId: event?.id ?? null };
  }

  async upsertFinancialReference(
    input: HoneyBookReferenceUpsertInput,
    options?: { actorId?: string | null },
  ): Promise<HoneyBookFinancialReferenceResult> {
    const payload = toHoneyBookReferenceInsert(input);
    const { data: reference, error } = await this.supabase
      .from("honeybook_financial_references")
      .insert(payload)
      .select("id")
      .single();

    if (error || !reference) {
      throw new Error(error?.message ?? "Unable to save HoneyBook reference.");
    }

    if (payload.honeybook_url) {
      await this.supabase
        .from("projects")
        .update({ honeybook_url: payload.honeybook_url, updated_at: new Date().toISOString() })
        .eq("id", input.projectId);
    }

    await this.supabase.from("activity_logs").insert({
      actor_id: options?.actorId ?? null,
      project_id: input.projectId,
      action: "honeybook_reference_imported",
      entity_type: "honeybook_financial_reference",
      entity_id: reference.id,
    });

    return { referenceId: reference.id };
  }

  async handleInboundEvent(event: HoneyBookInboundEvent): Promise<HoneyBookInboundResult> {
    const { data: existing } = await this.supabase
      .from("automation_logs")
      .select("id")
      .eq("automation_type", "honeybook_integration_event")
      .contains("metadata", { event_id: event.event_id })
      .maybeSingle();

    if (existing) {
      return { matched: true, duplicate: true, projectId: event.project_id ?? null };
    }

    let projectId = event.project_id ?? null;
    let clientId: string | null = null;

    if (!projectId && event.honeybook_project_id) {
      const { data: reference } = await this.supabase
        .from("honeybook_financial_references")
        .select("project_id,client_id")
        .eq("honeybook_project_id", event.honeybook_project_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      projectId = reference?.project_id ?? null;
      clientId = reference?.client_id ?? null;
    }

    if (projectId && !clientId) {
      const { data: project } = await this.supabase
        .from("projects")
        .select("client_id")
        .eq("id", projectId)
        .maybeSingle();
      clientId = project?.client_id ?? null;
    }

    if (!projectId || !clientId) {
      const { data: admins } = await this.supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "admin"])
        .eq("active", true);

      if (admins?.length) {
        await this.supabase.from("notifications").insert(
          admins.map((admin) => ({
            recipient_id: admin.id,
            type: "honeybook_record_needs_review",
            title: "HoneyBook record needs review",
            message: "A HoneyBook integration event could not be matched safely to a project.",
            action_url: "/admin/honeybook",
          })),
        );
      }

      await this.supabase.from("automation_logs").insert({
        automation_type: "honeybook_integration_event",
        status: "needs_review",
        metadata: event,
        executed_at: new Date().toISOString(),
      });

      return { matched: false, projectId: null };
    }

    await this.upsertFinancialReference(
      {
        projectId,
        clientId,
        honeybookProjectId: event.honeybook_project_id,
        honeybookInvoiceNumber: event.invoice_number,
        invoiceTotal: event.invoice_total,
        amountPaid: event.amount_paid,
        balanceRemaining: event.balance_remaining,
        invoiceStatus: event.invoice_status,
        dueDate: event.due_date,
        honeybookUrl: event.honeybook_url,
        source: "automation",
      },
      { actorId: null },
    );

    let stage: HoneyBookPipelineStage | null = event.stage ?? null;
    if (!stage) {
      const status = (event.invoice_status ?? "").toLowerCase();
      if (status.includes("paid")) stage = "invoice_paid";
      else if (event.event_type.toLowerCase().includes("approved")) stage = "proposal_approved";
      else if (event.event_type.toLowerCase().includes("sent")) stage = "proposal_sent";
    }

    if (stage) {
      await this.markStage(stage, {
        projectId,
        source: "honeybook_api",
        metadata: { event_id: event.event_id, event_type: event.event_type },
      });
    }

    await this.supabase.from("automation_logs").insert({
      automation_type: "honeybook_integration_event",
      project_id: projectId,
      status: "success",
      metadata: event,
      executed_at: new Date().toISOString(),
    });

    return { matched: true, projectId, stage };
  }
}
