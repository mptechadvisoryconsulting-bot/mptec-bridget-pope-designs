import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { getHoneyBookService } from "@/lib/integrations/honeybook";
import { createAdminClient } from "@/lib/supabase/admin";
import { honeybookReferenceSchema } from "@/lib/validation/honeybook-schema";

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const parsed = honeybookReferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid HoneyBook reference." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id,client_id")
    .eq("id", input.projectId)
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ success: false, message: "Project does not belong to the selected client." }, { status: 400 });
  }

  try {
    const honeybook = getHoneyBookService(supabase);
    const { referenceId } = await honeybook.upsertFinancialReference(
      {
        projectId: input.projectId,
        clientId: input.clientId,
        honeybookProjectId: input.honeybookProjectId || null,
        honeybookInvoiceNumber: input.honeybookInvoiceNumber || null,
        invoiceTotal: input.invoiceTotal === "" ? null : input.invoiceTotal ?? null,
        amountPaid: input.amountPaid === "" ? null : input.amountPaid ?? null,
        balanceRemaining: input.balanceRemaining === "" ? null : input.balanceRemaining ?? null,
        invoiceStatus: input.invoiceStatus || null,
        invoiceDate: input.invoiceDate || null,
        dueDate: input.dueDate || null,
        honeybookUrl: input.honeybookUrl || null,
        source: input.source,
      },
      { actorId: admin.profile.id },
    );

    await supabase.from("notifications").insert({
      recipient_id: admin.profile.id,
      project_id: input.projectId,
      type: "honeybook_reference_imported",
      title: "HoneyBook reference saved",
      message: "A HoneyBook financial reference was linked to this project.",
      action_url: `/admin/projects/${input.projectId}`,
    });

    await supabase.from("activity_logs").insert({
      actor_id: admin.profile.id,
      project_id: input.projectId,
      action: "honeybook_reference_imported",
      entity_type: "honeybook_financial_reference",
      entity_id: referenceId,
    });

    return NextResponse.json({ success: true, referenceId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save HoneyBook reference.";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
