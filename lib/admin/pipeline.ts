import type { SupabaseClient } from "@supabase/supabase-js";
import { first } from "@/lib/supabase/relations";
import type { PipelineAction, PipelineStage } from "@/lib/admin/pipeline-constants";
import { provisionClientFromLead } from "@/lib/provisioning/provision-client";

export type { PipelineAction } from "@/lib/admin/pipeline-constants";
export { pipelineActions, pipelineStageLabels } from "@/lib/admin/pipeline-constants";

type AnyClient = SupabaseClient;

export type PipelineActionInput = {
  action: PipelineAction;
  actorId?: string | null;
  proposalId?: string | null;
  invoiceId?: string | null;
  note?: string | null;
};

export type PipelineActionResult = {
  success: boolean;
  message?: string;
  stage?: PipelineStage;
  proposalUrl?: string;
  provisioned?: boolean;
  warning?: string;
};

type ProjectRow = {
  id: string;
  lead_id?: string | null;
  client_id?: string | null;
  event_name?: string | null;
  pipeline_stage?: string | null;
  assigned_admin_id?: string | null;
  status?: string | null;
  bpd_clients?:
    | { profile_id?: string | null }
    | Array<{ profile_id?: string | null }>
    | null;
};

async function loadProject(supabase: AnyClient, projectId: string): Promise<ProjectRow | null> {
  const { data } = await supabase
    .from("projects")
    .select("id,lead_id,client_id,event_name,pipeline_stage,assigned_admin_id,status,bpd_clients(profile_id)")
    .eq("id", projectId)
    .maybeSingle();
  return (data as ProjectRow | null) ?? null;
}

async function setPipelineStage(
  supabase: AnyClient,
  stage: PipelineStage,
  context: {
    projectId: string;
    actorId?: string | null;
    leadId?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
    source?: "manual" | "system";
  },
) {
  const source = context.source ?? "manual";
  const metadata = {
    ...(context.metadata ?? {}),
    ...(context.note ? { note: context.note } : {}),
  };

  const { data: project } = await supabase
    .from("projects")
    .select("id,lead_id")
    .eq("id", context.projectId)
    .maybeSingle();

  const leadId = context.leadId ?? project?.lead_id ?? null;

  const { error: projectError } = await supabase
    .from("projects")
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", context.projectId);

  if (projectError) throw new Error(projectError.message);

  const { data: event, error: eventError } = await supabase
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

async function notifyOwners(
  supabase: AnyClient,
  input: {
    projectId: string;
    type: string;
    title: string;
    message: string;
    actionUrl: string;
    extraRecipientIds?: Array<string | null | undefined>;
  },
) {
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["owner", "admin"])
    .eq("active", true);

  const recipientIds = new Set<string>();
  for (const admin of admins ?? []) {
    if (admin.id) recipientIds.add(admin.id);
  }
  for (const id of input.extraRecipientIds ?? []) {
    if (id) recipientIds.add(id);
  }

  if (!recipientIds.size) return;

  await supabase.from("notifications").insert(
    [...recipientIds].map((recipient_id) => ({
      recipient_id,
      project_id: input.projectId,
      type: input.type,
      title: input.title,
      message: input.message,
      action_url: input.actionUrl,
    })),
  );
}

async function notifyClient(
  supabase: AnyClient,
  project: ProjectRow,
  input: { type: string; title: string; message: string; actionUrl: string },
) {
  const client = first(project.bpd_clients);
  if (!client?.profile_id) return;

  await supabase.from("notifications").insert({
    recipient_id: client.profile_id,
    project_id: project.id,
    type: input.type,
    title: input.title,
    message: input.message,
    action_url: input.actionUrl,
  });
}

async function logAutomation(
  supabase: AnyClient,
  input: {
    projectId: string;
    leadId?: string | null;
    action: PipelineAction;
    stage: PipelineStage;
    status: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("automation_logs").insert({
    automation_type: "pipeline_action",
    project_id: input.projectId,
    lead_id: input.leadId ?? null,
    status: input.status,
    metadata: {
      action: input.action,
      stage: input.stage,
      ...(input.metadata ?? {}),
    },
    executed_at: new Date().toISOString(),
  });
}

async function logActivity(
  supabase: AnyClient,
  input: {
    actorId?: string | null;
    projectId: string;
    leadId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    project_id: input.projectId,
    lead_id: input.leadId ?? null,
    action: input.action,
    entity_type: input.entityType ?? "project",
    entity_id: input.entityId ?? input.projectId,
    metadata: input.metadata ?? {},
  });
}

export async function runPipelineAction(
  supabase: AnyClient,
  projectId: string,
  input: PipelineActionInput,
): Promise<PipelineActionResult> {
  const project = await loadProject(supabase, projectId);
  if (!project) {
    return { success: false, message: "Project not found." };
  }

  const note = input.note?.trim() || null;
  const eventName = project.event_name || "Project";

  if (input.action === "open_proposal") {
    const stage: PipelineStage = "proposal_workspace";
    await setPipelineStage(supabase, stage, {
      projectId,
      actorId: input.actorId,
      leadId: project.lead_id,
      note,
      metadata: { proposalId: input.proposalId ?? null },
      source: "manual",
    });

    const proposalUrl = input.proposalId
      ? `/admin/proposals/${input.proposalId}`
      : `/admin/proposals/new?projectId=${projectId}`;

    await logActivity(supabase, {
      actorId: input.actorId,
      projectId,
      leadId: project.lead_id,
      action: "pipeline_open_proposal",
      metadata: { stage, proposal_url: proposalUrl, note },
    });
    await logAutomation(supabase, {
      projectId,
      leadId: project.lead_id,
      action: input.action,
      stage,
      status: "success",
      metadata: { proposal_url: proposalUrl },
    });

    return {
      success: true,
      stage,
      proposalUrl,
      message: "Proposal workspace opened and pipeline updated.",
    };
  }

  if (input.action === "proposal_sent") {
    const stage: PipelineStage = "proposal_sent";
    await setPipelineStage(supabase, stage, {
      projectId,
      actorId: input.actorId,
      leadId: project.lead_id,
      note,
      metadata: { proposalId: input.proposalId ?? null },
      source: "manual",
    });

    if (input.proposalId) {
      await supabase
        .from("proposals")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", input.proposalId)
        .eq("project_id", projectId);
    }

    await notifyClient(supabase, project, {
      type: "proposal_sent",
      title: "Proposal ready for review",
      message: `A proposal for ${eventName} is ready for your review.`,
      actionUrl: "/client/proposals",
    });
    await notifyOwners(supabase, {
      projectId,
      type: "pipeline_proposal_sent",
      title: "Proposal marked sent",
      message: `${eventName} moved to proposal sent.`,
      actionUrl: `/admin/projects/${projectId}`,
      extraRecipientIds: [project.assigned_admin_id],
    });
    await logActivity(supabase, {
      actorId: input.actorId,
      projectId,
      leadId: project.lead_id,
      action: "pipeline_proposal_sent",
      entityType: input.proposalId ? "proposal" : "project",
      entityId: input.proposalId ?? projectId,
      metadata: { stage, note },
    });
    await logAutomation(supabase, {
      projectId,
      leadId: project.lead_id,
      action: input.action,
      stage,
      status: "success",
    });

    return { success: true, stage, message: "Pipeline updated to proposal sent." };
  }

  if (input.action === "proposal_approved") {
    const stage: PipelineStage = "proposal_approved";
    let provisioned = false;
    let warning: string | undefined;

    if (input.proposalId) {
      await supabase
        .from("proposals")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", input.proposalId)
        .eq("project_id", projectId);
    }

    if (project.lead_id) {
      const provision = await provisionClientFromLead(supabase, {
        leadId: project.lead_id,
        actorId: input.actorId,
        inviteToPortal: true,
      });
      if (!provision.success) {
        warning = provision.message;
      } else {
        provisioned = true;
        if (provision.warning) warning = provision.warning;
      }
    }

    const nextProjectStatus =
      !project.status || project.status === "pending"
        ? "booked"
        : project.status === "booked"
          ? "planning"
          : project.status;

    await supabase
      .from("projects")
      .update({ status: nextProjectStatus, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    await setPipelineStage(supabase, stage, {
      projectId,
      actorId: input.actorId,
      leadId: project.lead_id,
      note,
      metadata: {
        proposalId: input.proposalId ?? null,
        provisioned,
        warning: warning ?? null,
      },
      source: "manual",
    });

    await notifyClient(supabase, project, {
      type: "proposal_approved",
      title: "Proposal approved",
      message: `Your proposal for ${eventName} was approved. Next steps are ready in your portal.`,
      actionUrl: "/client/dashboard",
    });
    await notifyOwners(supabase, {
      projectId,
      type: "pipeline_proposal_approved",
      title: provisioned ? "Proposal approved · client provisioned" : "Proposal approved",
      message: provisioned
        ? `${eventName} was approved and the client portal invite path ran.`
        : `${eventName} was approved.`,
      actionUrl: `/admin/projects/${projectId}`,
      extraRecipientIds: [project.assigned_admin_id],
    });
    await logActivity(supabase, {
      actorId: input.actorId,
      projectId,
      leadId: project.lead_id,
      action: "pipeline_proposal_approved",
      entityType: input.proposalId ? "proposal" : "project",
      entityId: input.proposalId ?? projectId,
      metadata: { stage, provisioned, warning: warning ?? null, note },
    });
    await logAutomation(supabase, {
      projectId,
      leadId: project.lead_id,
      action: input.action,
      stage,
      status: warning && !provisioned ? "partial" : "success",
      metadata: { provisioned, warning: warning ?? null },
    });

    return {
      success: true,
      stage,
      provisioned,
      warning,
      message: provisioned
        ? "Proposal approved, client provisioned, pipeline updated."
        : "Proposal approved and pipeline updated.",
    };
  }

  if (input.action === "invoice_paid") {
    const stage: PipelineStage = "invoice_paid";

    if (input.invoiceId) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("id,total,amount_paid,project_id")
        .eq("id", input.invoiceId)
        .eq("project_id", projectId)
        .maybeSingle();

      if (invoice) {
        const total = Number(invoice.total ?? 0);
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            amount_paid: total,
            balance_due: 0,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.invoiceId);
      }
    }

    await setPipelineStage(supabase, stage, {
      projectId,
      actorId: input.actorId,
      leadId: project.lead_id,
      note,
      metadata: { invoiceId: input.invoiceId ?? null },
      source: "manual",
    });

    await notifyOwners(supabase, {
      projectId,
      type: "pipeline_invoice_paid",
      title: "Invoice marked paid",
      message: `${eventName} moved to invoice paid.`,
      actionUrl: `/admin/projects/${projectId}`,
      extraRecipientIds: [project.assigned_admin_id],
    });
    await notifyClient(supabase, project, {
      type: "invoice_paid",
      title: "Payment recorded",
      message: `A payment for ${eventName} was recorded.`,
      actionUrl: "/client/invoices",
    });
    await logActivity(supabase, {
      actorId: input.actorId,
      projectId,
      leadId: project.lead_id,
      action: "pipeline_invoice_paid",
      entityType: input.invoiceId ? "invoice" : "project",
      entityId: input.invoiceId ?? projectId,
      metadata: { stage, note },
    });
    await logAutomation(supabase, {
      projectId,
      leadId: project.lead_id,
      action: input.action,
      stage,
      status: "success",
    });

    return { success: true, stage, message: "Pipeline updated to invoice paid." };
  }

  if (input.action === "project_started") {
    const stage: PipelineStage = "project_started";
    const nextStatus =
      project.status === "design_in_progress" || project.status === "awaiting_client_approval"
        ? project.status
        : project.status === "planning"
          ? "design_in_progress"
          : "planning";

    await supabase
      .from("projects")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    await setPipelineStage(supabase, stage, {
      projectId,
      actorId: input.actorId,
      leadId: project.lead_id,
      note,
      metadata: { project_status: nextStatus },
      source: "manual",
    });

    await notifyClient(supabase, project, {
      type: "project_started",
      title: "Project started",
      message: `Work on ${eventName} has started.`,
      actionUrl: "/client/dashboard",
    });
    await notifyOwners(supabase, {
      projectId,
      type: "pipeline_project_started",
      title: "Project started",
      message: `${eventName} moved to project started (${nextStatus.replace(/_/g, " ")}).`,
      actionUrl: `/admin/projects/${projectId}`,
      extraRecipientIds: [project.assigned_admin_id],
    });
    await logActivity(supabase, {
      actorId: input.actorId,
      projectId,
      leadId: project.lead_id,
      action: "pipeline_project_started",
      metadata: { stage, project_status: nextStatus, note },
    });
    await logAutomation(supabase, {
      projectId,
      leadId: project.lead_id,
      action: input.action,
      stage,
      status: "success",
      metadata: { project_status: nextStatus },
    });

    return { success: true, stage, message: "Pipeline updated to project started." };
  }

  return { success: false, message: "Unknown pipeline action." };
}

/** Advance pipeline after in-app proposal approval (idempotent with manual action). */
export async function advancePipelineOnProposalApproval(
  supabase: AnyClient,
  input: {
    projectId: string;
    proposalId: string;
    actorId?: string | null;
    leadId?: string | null;
  },
): Promise<{ provisioned: boolean; warning?: string }> {
  const result = await runPipelineAction(supabase, input.projectId, {
    action: "proposal_approved",
    actorId: input.actorId,
    proposalId: input.proposalId,
    note: "Approved via in-app proposal approval",
  });

  return {
    provisioned: Boolean(result.provisioned),
    warning: result.warning,
  };
}
