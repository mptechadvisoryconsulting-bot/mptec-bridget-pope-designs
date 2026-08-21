import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/invoices/InvoiceDocument";
import { DownloadInvoicePdfButton } from "@/components/invoices/DownloadInvoicePdfButton";
import { InvoicePaymentHistory } from "@/components/invoices/InvoicePaymentHistory";
import { OfflinePaymentInstructions } from "@/components/invoices/OfflinePaymentInstructions";
import { PrintInvoiceButton } from "@/components/invoices/PrintInvoiceButton";
import { StripeCheckoutButton } from "@/components/payments/StripeCheckoutButton";
import { displayName } from "@/lib/auth/current-profile";
import { formatOfflinePaymentInstructions, loadOfflinePaymentSettings } from "@/lib/business/payment-instructions";
import { isClientVisibleInvoice } from "@/lib/invoices/client-visibility";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ClientInvoiceDetailPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { profile, client } = await requireClientPortalContext(`/client/invoices/${invoiceId}`);
  const supabase = createAdminClient();
  const [{ data: invoice }, { data: stripeSettings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "*, bpd_invoice_items(*), bpd_invoice_versions(*), bpd_projects!project_id(event_name,event_date,venue_name,bpd_clients!client_id(profile_id))",
      )
      .eq("id", invoiceId)
      .maybeSingle(),
    supabase
      .from("business_settings")
      .select("stripe_connected_account_id,stripe_payment_model,payment_readiness_status")
      .limit(1)
      .maybeSingle(),
  ]);

  if (!invoice || invoice.client_id !== client?.id || !isClientVisibleInvoice(invoice)) {
    notFound();
  }

  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const owningClient = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;

  if (owningClient?.profile_id !== profile.id) {
    notFound();
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id,amount,gross_amount,payment_method,payment_model,status,paid_at,metadata,created_at")
    .eq("invoice_id", invoiceId)
    .order("paid_at", { ascending: false });

  const items = invoice.bpd_invoice_items ?? [];
  const isPayable = !["draft", "paid", "cancelled", "refunded", "void"].includes(invoice.status) && Number(invoice.balance_due ?? 0) > 0;
  const stripeReady = Boolean(
    stripeSettings?.stripe_connected_account_id &&
      stripeSettings?.stripe_payment_model === "direct_charge_v2" &&
      stripeSettings?.payment_readiness_status === "ready",
  );
  const paymentSettings = await loadOfflinePaymentSettings(supabase);
  const offlinePaymentInstructions = formatOfflinePaymentInstructions(paymentSettings);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Invoice</span>
          <h1>{invoice.invoice_number}</h1>
        </div>
        <div className="topbar-actions invoice-actions-print">
          <DownloadInvoicePdfButton invoiceId={invoice.id} />
          <PrintInvoiceButton />
        </div>
      </div>

      {isPayable ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>Payment</h2>
          {stripeReady ? (
            <>
              <p className="mini-meta">
                Pay online through Bridget Pope Designs&apos; secure Stripe checkout, or use an offline payment arrangement below.
              </p>
              <div style={{ maxWidth: 360, margin: "14px 0 18px" }}>
                <StripeCheckoutButton invoiceId={invoice.id} />
              </div>
            </>
          ) : (
            <p className="mini-meta">
              Payment arrangements are handled directly with Bridget Pope Designs. Your balance updates when a payment is recorded.
            </p>
          )}
          <OfflinePaymentInstructions settings={paymentSettings} compact />
        </section>
      ) : null}

      <InvoicePaymentHistory payments={payments ?? []} />

      <section className="panel invoice-shell" style={{ marginTop: 16 }}>
        <InvoiceDocument
          clientEmail={profile.email}
          clientName={displayName(profile)}
          invoice={invoice}
          items={items}
          offlinePaymentInstructions={offlinePaymentInstructions}
          projectName={project?.event_name}
          venue={project?.venue_name}
        />
      </section>
    </div>
  );
}
