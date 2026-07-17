import { NextResponse } from "next/server";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-calculations";
import { resolveInvoiceTemplate } from "@/lib/invoices/templates";
import { invoiceEditSchema } from "@/lib/validation/invoice-edit-schema";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const adminRoles = new Set(["owner", "admin"]);

// Invoices in these terminal statuses are financially settled/closed and must not be edited.
const nonEditableStatuses = new Set(["paid", "cancelled", "refunded", "partially_refunded"]);

function notFound() {
  return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const server = await getSupabaseServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) return notFound();

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.active) return notFound();

  const { data, error } = await supabase
    .from("invoices")
    .select("*, bpd_invoice_items(*), bpd_invoice_versions(*), bpd_projects(client_id,bpd_clients(profile_id))")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !data) return notFound();

  const project = Array.isArray(data.bpd_projects) ? data.bpd_projects[0] : data.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id;

  if (!canAccess) return notFound();

  return NextResponse.json({ success: true, invoice: data });
}

/**
 * Draft invoices are updated in place. Once an invoice has been sent (or is otherwise
 * beyond draft), edits create a new immutable `invoice_versions` row and promote it to
 * `active_version` so the previously sent version, its template snapshot, and its PDF
 * reference remain untouched for audit/history purposes.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await params;
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,project_id,client_id,status,active_version,template_id,template_overrides,amount_paid")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return notFound();

  if (nonEditableStatuses.has(invoice.status)) {
    return NextResponse.json(
      { success: false, message: `Invoices with status "${invoice.status}" can no longer be edited.` },
      { status: 400 },
    );
  }

  const input = invoiceEditSchema.parse(await request.json());
  const totals = calculateInvoiceTotals(input.items, input.taxAmount, input.discountAmount);
  const amountPaid = Number(invoice.amount_paid ?? 0);
  const balanceDue = Math.max(0, Number((totals.total - amountPaid).toFixed(2)));

  const templateOverrides = {
    ...(invoice.template_overrides ?? {}),
    ...Object.fromEntries(Object.entries(input.templateOverrides).filter(([, value]) => value !== undefined && value !== "")),
  };
  const { template, snapshot } = await resolveInvoiceTemplate(supabase, input.templateId ?? invoice.template_id ?? undefined, templateOverrides);

  const isDraft = invoice.status === "draft";
  const currentVersion = Number(invoice.active_version ?? 1) || 1;
  const nextVersion = isDraft ? currentVersion : currentVersion + 1;

  const { data: updatedInvoice, error: updateError } = await supabase
    .from("invoices")
    .update({
      invoice_type: input.invoiceType,
      description: input.description,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      discount_amount: totals.discountAmount,
      total: totals.total,
      balance_due: balanceDue,
      due_date: input.dueDate,
      template_id: template.id,
      template_snapshot: snapshot,
      template_overrides: templateOverrides,
      active_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select()
    .single();

  if (updateError || !updatedInvoice) {
    return NextResponse.json({ success: false, message: updateError?.message ?? "Unable to update invoice." }, { status: 400 });
  }

  await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  const { error: itemError } = await supabase.from("invoice_items").insert(
    totals.items.map((item) => ({
      invoice_id: invoiceId,
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    })),
  );

  if (itemError) {
    return NextResponse.json({ success: false, message: "Unable to update invoice line items." }, { status: 400 });
  }

  const invoiceSnapshot = {
    invoice: updatedInvoice,
    items: totals.items,
    totals: {
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount: totals.discountAmount,
      total: totals.total,
    },
  };

  if (isDraft) {
    // Keep the single draft version row in sync; it is not yet a historical record.
    await supabase
      .from("invoice_versions")
      .update({ template_id: template.id, template_snapshot: snapshot, invoice_snapshot: invoiceSnapshot })
      .eq("invoice_id", invoiceId)
      .eq("version_number", currentVersion);
  } else {
    await supabase
      .from("invoice_versions")
      .update({ status: "superseded" })
      .eq("invoice_id", invoiceId)
      .eq("version_number", currentVersion);

    const { error: versionError } = await supabase.from("invoice_versions").insert({
      invoice_id: invoiceId,
      version_number: nextVersion,
      template_id: template.id,
      template_snapshot: snapshot,
      invoice_snapshot: invoiceSnapshot,
      status: "active",
      created_by: admin.profile.id,
    });

    if (versionError) {
      return NextResponse.json({ success: false, message: "Unable to record the new invoice version." }, { status: 400 });
    }

    await supabase.from("activity_logs").insert({
      actor_id: admin.profile.id,
      project_id: invoice.project_id,
      action: "invoice_revised",
      entity_type: "invoice",
      entity_id: invoiceId,
      metadata: { previous_version: currentVersion, new_version: nextVersion },
    });
  }

  return NextResponse.json({ success: true, invoice: updatedInvoice, versionNumber: nextVersion });
}
