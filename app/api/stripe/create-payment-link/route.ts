import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { appUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

const paymentLinkSchema = z.object({
  invoiceId: z.string().uuid(),
});
const nonPayableStatuses = new Set(["paid", "cancelled", "refunded"]);

export async function POST(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const input = paymentLinkSchema.parse(await request.json());
  const supabase = createAdminClient();
  const stripe = getStripe();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id,invoice_number,description,balance_due,status,project_id,client_id,proposal_id,invoice_type,bpd_projects(assigned_admin_id,bpd_clients(profile_id))")
    .eq("id", input.invoiceId)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });
  }

  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;
  const balanceDue = Number(invoice.balance_due ?? 0);

  if (!canAccess) {
    return NextResponse.json({ success: false, message: "Invoice not found" }, { status: 404 });
  }

  if (nonPayableStatuses.has(invoice.status) || balanceDue <= 0) {
    return NextResponse.json({ success: false, message: "This invoice is not payable." }, { status: 400 });
  }

  const price = await stripe.prices.create({
    currency: "usd",
    product_data: { name: invoice.description ?? `Invoice ${invoice.invoice_number}` },
    unit_amount: Math.round(balanceDue * 100),
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
      redirect: { url: `${appUrl()}/client/invoices/${invoice.id}?payment=success` },
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
    .update({ stripe_payment_link_id: link.id, stripe_payment_link_url: link.url })
    .eq("id", invoice.id);

  return NextResponse.json({ success: true, url: link.url });
}
