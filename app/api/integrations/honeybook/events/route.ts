import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { honeybookIntegrationEventSchema } from "@/lib/validation/honeybook-schema";

export async function POST(request: Request) {
  if (process.env.HONEYBOOK_INTEGRATION_ENABLED !== "true") {
    return NextResponse.json({ success: false, message: "HoneyBook integration is not enabled." }, { status: 404 });
  }

  const expectedSecret = process.env.HONEYBOOK_INTEGRATION_SECRET;
  const providedSecret = request.headers.get("x-honeybook-integration-secret");

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const parsed = honeybookIntegrationEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid HoneyBook event." },
      { status: 400 },
    );
  }

  const event = parsed.data;
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("automation_logs")
    .select("id")
    .eq("automation_type", "honeybook_integration_event")
    .contains("metadata", { event_id: event.event_id })
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  let projectId: string | null = null;
  let clientId: string | null = null;

  if (event.honeybook_project_id) {
    const { data: reference } = await supabase
      .from("honeybook_financial_references")
      .select("project_id,client_id")
      .eq("honeybook_project_id", event.honeybook_project_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    projectId = reference?.project_id ?? null;
    clientId = reference?.client_id ?? null;
  }

  if (!projectId || !clientId) {
    const { data: admins } = await supabase.from("profiles").select("id").in("role", ["owner", "admin"]).eq("active", true);
    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map((admin) => ({
          recipient_id: admin.id,
          type: "honeybook_record_needs_review",
          title: "HoneyBook record needs review",
          message: "A HoneyBook integration event could not be matched safely to a project.",
          action_url: "/admin/honeybook",
        })),
      );
    }

    await supabase.from("automation_logs").insert({
      automation_type: "honeybook_integration_event",
      status: "needs_review",
      metadata: event,
      executed_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, matched: false });
  }

  await supabase.from("honeybook_financial_references").insert({
    project_id: projectId,
    client_id: clientId,
    honeybook_project_id: event.honeybook_project_id ?? null,
    honeybook_invoice_number: event.invoice_number ?? null,
    invoice_total: event.invoice_total ?? null,
    amount_paid: event.amount_paid ?? null,
    balance_remaining: event.balance_remaining ?? null,
    invoice_status: event.invoice_status ?? "unknown",
    due_date: event.due_date ?? null,
    honeybook_url: event.honeybook_url ?? null,
    source: "automation",
    review_status: "confirmed",
    imported_at: event.occurred_at,
  });

  await supabase.from("automation_logs").insert({
    automation_type: "honeybook_integration_event",
    project_id: projectId,
    status: "success",
    metadata: event,
    executed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, matched: true });
}
