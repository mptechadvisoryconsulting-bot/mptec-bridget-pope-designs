import { ReceiptText } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { applyClientInvoiceVisibilityFilter } from "@/lib/invoices/client-visibility";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  total: number;
  amount_paid: number;
  balance_due: number;
  due_date?: string | null;
  status: string;
  bpd_projects?: { event_name?: string | null } | Array<{ event_name?: string | null }> | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function ClientInvoicesPage() {
  const { client } = await requireClientPortalContext("/client/invoices");
  const { data: invoices } = client?.id
    ? await applyClientInvoiceVisibilityFilter(
        createAdminClient()
          .from("invoices")
          .select("id,invoice_number,invoice_type,total,amount_paid,balance_due,due_date,status,bpd_projects(event_name)")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false }),
      )
    : { data: [] };

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Invoices</span>
          <h1>Invoices and Receipts</h1>
          <p className="mini-meta">Only invoices connected to your Bridget Pope Designs project appear here.</p>
        </div>
      </div>

      <section className="panel">
        <h2>Invoice History</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Project</th>
              <th>Status</th>
              <th>Total</th>
              <th>Balance</th>
              <th>Due</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {((invoices ?? []) as InvoiceRow[]).map((invoice) => {
              const project = first(invoice.bpd_projects);
              return (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>
                  <td>{project?.event_name ?? "Project"}</td>
                  <td><span className="status">{invoice.status}</span></td>
                  <td>{currency(Number(invoice.total ?? 0))}</td>
                  <td>{currency(Number(invoice.balance_due ?? 0))}</td>
                  <td>{invoice.due_date ?? "Not set"}</td>
                  <td>
                    <ButtonLink href={`/client/invoices/${invoice.id}`} variant="light">
                      <ReceiptText size={16} /> Open
                    </ButtonLink>
                  </td>
                </tr>
              );
            })}
            {!invoices?.length ? (
              <tr>
                <td colSpan={7}>No invoices have been shared with your portal yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
