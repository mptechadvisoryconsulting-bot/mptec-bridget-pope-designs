import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-calculations";
import { invoiceSchema } from "@/lib/validation/invoice-schema";
import { createAdminClient } from "@/lib/supabase/admin";

function invoiceNumber() {
  return `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = invoiceSchema.parse(await request.json());
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

  if (input.proposalId) {
    const { data: proposal } = await supabase
      .from("proposals")
      .select("id")
      .eq("id", input.proposalId)
      .eq("project_id", input.projectId)
      .maybeSingle();

    if (!proposal) {
      return NextResponse.json({ success: false, message: "Proposal does not belong to the selected project." }, { status: 400 });
    }
  }

  const totals = calculateInvoiceTotals(input.items, input.taxAmount, input.discountAmount);
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      project_id: input.projectId,
      client_id: input.clientId,
      proposal_id: input.proposalId,
      invoice_number: invoiceNumber(),
      invoice_type: input.invoiceType,
      description: input.description,
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      discount_amount: totals.discountAmount,
      total: totals.total,
      amount_paid: 0,
      balance_due: totals.total,
      due_date: input.dueDate,
      status: "pending",
    })
    .select()
    .single();
  if (error || !invoice) return NextResponse.json({ success: false, message: error?.message ?? "Invoice failed" }, { status: 400 });

  const { error: itemError } = await supabase.from("invoice_items").insert(
    totals.items.map((item) => ({
      invoice_id: invoice.id,
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    })),
  );

  if (itemError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return NextResponse.json({ success: false, message: "Unable to create invoice line items." }, { status: 400 });
  }

  return NextResponse.json({ success: true, invoice }, { status: 201 });
}
