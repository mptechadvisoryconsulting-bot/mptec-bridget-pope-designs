import { NextResponse } from "next/server";
import { z } from "zod";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

const paymentLinkSchema = z.object({
  invoiceId: z.string().uuid(),
});

export async function POST(request: Request) {
  const input = paymentLinkSchema.parse(await request.json());
  const supabase = createAdminClient();
  const stripe = getStripe();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,description,total,project_id,client_id,proposal_id,invoice_type")
    .eq("id", input.invoiceId)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });
  }

  const price = await stripe.prices.create({
    currency: "usd",
    product_data: { name: invoice.description ?? `Invoice ${invoice.invoice_number}` },
    unit_amount: Math.round(Number(invoice.total) * 100),
  });

  const link = await stripe.paymentLinks.create({
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    after_completion: {
      type: "redirect",
      redirect: { url: `${appUrl()}/client/dashboard?payment=success` },
    },
    metadata: {
      invoice_id: invoice.id,
      project_id: invoice.project_id,
      client_id: invoice.client_id,
      proposal_id: invoice.proposal_id ?? "",
      payment_type: invoice.invoice_type,
      invoice_number: invoice.invoice_number,
    },
  });

  await supabase
    .from("invoices")
    .update({ stripe_payment_link_id: link.id, stripe_payment_link_url: link.url, status: "pending" })
    .eq("id", invoice.id);

  return NextResponse.json({ success: true, url: link.url });
}
