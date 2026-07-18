import { NextResponse } from "next/server";
import { canCancelInvoice, invoiceCancelStatus } from "@/lib/billing/document-actions";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { invoiceId } = await params;
  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id,status,project_id,invoice_number,amount_paid,balance_due")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
  }

  if (!canCancelInvoice(String(invoice.status))) {
    return NextResponse.json(
      {
        success: false,
        message:
          invoice.status === "paid"
            ? "Paid invoices cannot be cancelled."
            : `Invoices with status "${invoice.status}" cannot be cancelled.`,
      },
      { status: 400 },
    );
  }

  const nextStatus = invoiceCancelStatus(String(invoice.status));
  const { data: updated, error } = await supabase
    .from("invoices")
    .update({
      status: nextStatus,
      balance_due: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .select("id,status,invoice_number")
    .single();

  if (error || !updated) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to cancel invoice." }, { status: 400 });
  }

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    project_id: invoice.project_id,
    action: "invoice_cancelled",
    entity_type: "invoice",
    entity_id: invoiceId,
    metadata: {
      invoice_number: invoice.invoice_number,
      previous_status: invoice.status,
      status: nextStatus,
      amount_paid: invoice.amount_paid,
    },
  });

  return NextResponse.json({
    success: true,
    invoice: updated,
    message: nextStatus === "void" ? "Invoice voided." : "Invoice cancelled.",
  });
}
