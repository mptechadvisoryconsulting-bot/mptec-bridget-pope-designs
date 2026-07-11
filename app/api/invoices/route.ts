import { NextResponse } from "next/server";
import { invoiceSchema } from "@/lib/validation/invoice-schema";
import { createAdminClient } from "@/lib/supabase/admin";

function invoiceNumber() {
  return `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function POST(request: Request) {
  const input = invoiceSchema.parse(await request.json());
  const subtotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = Math.max(0, subtotal + input.taxAmount - input.discountAmount);
  const supabase = createAdminClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      project_id: input.projectId,
      client_id: input.clientId,
      proposal_id: input.proposalId,
      invoice_number: invoiceNumber(),
      invoice_type: input.invoiceType,
      description: input.description,
      subtotal,
      tax_amount: input.taxAmount,
      discount_amount: input.discountAmount,
      total,
      amount_paid: 0,
      balance_due: total,
      due_date: input.dueDate,
      status: "draft",
    })
    .select()
    .single();
  if (error || !invoice) return NextResponse.json({ success: false, message: error?.message ?? "Invoice failed" }, { status: 400 });

  await supabase.from("invoice_items").insert(
    input.items.map((item) => ({
      invoice_id: invoice.id,
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })),
  );

  return NextResponse.json({ success: true, invoice }, { status: 201 });
}
