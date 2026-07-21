import { InvoiceCreateForm } from "@/components/invoices/InvoiceCreateForm";
import { ImportInvoicePdfForm } from "@/components/invoices/ImportInvoicePdfForm";
import { InvoiceDocumentActions } from "@/components/invoices/InvoiceDocumentActions";
import { CollapsibleImportPanel } from "@/components/admin/CollapsibleImportPanel";
import { ListPageActions } from "@/components/admin/ListPageActions";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ClientRow = {
  id: string;
  bpd_profiles?: {
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    email?: string | null;
  } | Array<{
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    email?: string | null;
  }> | null;
};

type ProjectRow = {
  id: string;
  client_id: string;
  event_name: string;
  status: string;
};

type ProposalRow = {
  id: string;
  project_id: string;
  proposal_number?: string | null;
  title?: string | null;
  total?: number | null;
};

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  total: number;
  balance_due: number;
  amount_paid?: number | null;
  status: string;
  due_date?: string | null;
  bpd_clients?: ClientRow | ClientRow[] | null;
  bpd_projects?: { event_name?: string | null } | Array<{ event_name?: string | null }> | null;
};

type TemplateRow = {
  id: string;
  name: string;
  is_default: boolean;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function clientName(client: ClientRow | null) {
  const profile = first(client?.bpd_profiles);
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const supabase = createAdminClient();
  let invoicesQuery = supabase
    .from("invoices")
    .select("id,invoice_number,invoice_type,total,balance_due,amount_paid,status,due_date,bpd_clients!client_id(bpd_profiles(first_name,last_name,username,email)),bpd_projects!project_id(event_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (statusFilter === "unpaid") {
    invoicesQuery = invoicesQuery.gt("balance_due", 0).not("status", "eq", "draft");
  }

  const [{ data: clients }, { data: projects }, { data: proposals }, { data: templates }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("id,bpd_profiles(first_name,last_name,username,email)").order("created_at", { ascending: false }),
    supabase.from("projects").select("id,client_id,event_name,status").order("created_at", { ascending: false }),
    supabase.from("proposals").select("id,project_id,proposal_number,title,total").order("created_at", { ascending: false }),
    supabase.from("invoice_templates").select("id,name,is_default").order("is_default", { ascending: false }),
    invoicesQuery,
  ]);

  const clientOptions = ((clients ?? []) as ClientRow[]).map((client) => {
    const profile = first(client.bpd_profiles);
    return {
      id: client.id,
      name: clientName(client),
      username: profile?.username ?? "no-username",
    };
  });
  const projectOptions = ((projects ?? []) as ProjectRow[]).map((project) => ({
    id: project.id,
    clientId: project.client_id,
    name: project.event_name,
    status: project.status,
  }));
  const proposalOptions = ((proposals ?? []) as ProposalRow[]).map((proposal) => ({
    id: proposal.id,
    projectId: proposal.project_id,
    label: proposal.title || proposal.proposal_number || `Proposal ${proposal.id.slice(0, 8)}`,
  }));
  const templateOptions = ((templates ?? []) as TemplateRow[]).map((template) => ({
    id: template.id,
    name: template.name,
    isDefault: template.is_default,
  }));

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Billing</span>
          <h1>Invoices</h1>
        </div>
        <div className="topbar-actions">
          <ButtonLink href="/admin/invoices?status=unpaid" variant={statusFilter === "unpaid" ? "primary" : "light"}>
            Unpaid
          </ButtonLink>
          <ButtonLink href="/admin/invoices" variant={statusFilter ? "light" : "primary"}>
            All
          </ButtonLink>
          <ListPageActions
            importHref="#import-invoice-pdf"
            importLabel="Import PDF"
            primaryAction={{ label: "New invoice", href: "#create-invoice" }}
          />
        </div>
      </div>

      <div className="stack-page">
        <div id="create-invoice">
          <InvoiceCreateForm clients={clientOptions} projects={projectOptions} proposals={proposalOptions} templates={templateOptions} />
        </div>

        <CollapsibleImportPanel
          description="Upload an existing PDF to create an invoice record. Opens from Actions → Import PDF."
          id="import-invoice-pdf"
          title="Import Invoice PDF"
        >
          <ImportInvoicePdfForm clients={clientOptions} framed={false} projects={projectOptions} />
        </CollapsibleImportPanel>

        <section className="panel">
          <h2>{statusFilter === "unpaid" ? "Unpaid Invoices" : "Recent Invoices"}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Project</th>
                <th>Status</th>
                <th>Total</th>
                <th>Balance</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {((invoices ?? []) as InvoiceRow[]).map((invoice) => {
                const client = first(invoice.bpd_clients);
                const project = first(invoice.bpd_projects);

                return (
                  <tr key={invoice.id}>
                    <td><a href={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</a></td>
                    <td>{clientName(client)}</td>
                    <td>{project?.event_name ?? "Project"}</td>
                    <td><StatusBadge status={invoice.status} /></td>
                    <td>{currency(Number(invoice.total ?? 0))}</td>
                    <td>{currency(Number(invoice.balance_due ?? 0))}</td>
                    <td>
                      <InvoiceDocumentActions
                        amountPaid={Number(invoice.amount_paid ?? 0)}
                        extraActions={[{ label: "Preview", href: `/admin/invoices/${invoice.id}` }]}
                        invoiceId={invoice.id}
                        primaryHref={`/admin/invoices/${invoice.id}`}
                        primaryLabel="Open"
                        redirectOnDelete={null}
                        status={invoice.status}
                      />
                    </td>
                  </tr>
                );
              })}
              {!invoices?.length ? (
                <tr>
                  <td colSpan={7}>No invoices yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
