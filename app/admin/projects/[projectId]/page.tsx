import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { HoneyBookReferenceForm } from "@/components/honeybook/HoneyBookReferenceForm";
import { ProjectPipelineActions } from "@/components/admin/ProjectPipelineActions";
import { ButtonLink } from "@/components/ui/button";
import { currency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/dates";
import { loadProjectHoneyBookReferences } from "@/lib/honeybook/references";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";
import { projectStatusLabels, projectStatuses } from "@/lib/admin/constants";
import { pipelineStageLabels } from "@/lib/admin/pipeline-constants";
import { completeTask, reopenTask } from "@/lib/admin/workflow";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ action?: string; id?: string; status?: string }>;
}) {
  const { projectId } = await params;
  const { action, id, status } = await searchParams;
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();

  if (action === "status" && status) {
    await supabase.from("projects").update({ status, updated_at: new Date().toISOString() }).eq("id", projectId);
    await supabase.from("activity_logs").insert({ actor_id: profile?.id ?? null, project_id: projectId, action: "project_status_updated", entity_type: "project", entity_id: projectId, metadata: { status } });
    redirect(`/admin/projects/${projectId}`);
  }
  if (action === "complete-task" && id) {
    await completeTask(supabase, id, profile?.id);
    redirect(`/admin/projects/${projectId}`);
  }
  if (action === "reopen-task" && id) {
    await reopenTask(supabase, id, profile?.id);
    redirect(`/admin/projects/${projectId}`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*, bpd_clients(id,bpd_profiles(first_name,last_name,email,phone))")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: tasks }, { data: invoices }, { data: proposals }, { data: contracts }, honeybookReferences] = await Promise.all([
    supabase.from("tasks").select("id,title,due_date,priority,status").eq("project_id", projectId).order("due_date", { ascending: true }),
    supabase.from("invoices").select("id,invoice_number,total,balance_due,status").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("proposals").select("id,proposal_number,status,total").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("contracts").select("id,contract_number,status").eq("project_id", projectId).order("created_at", { ascending: false }),
    loadProjectHoneyBookReferences(supabase, projectId),
  ]);

  const client = first(project.bpd_clients);
  const clientProfile = first(client?.bpd_profiles);
  const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || "Client";
  const taskRows = tasks ?? [];
  const invoiceRows = invoices ?? [];
  const proposalRows = proposals ?? [];
  const balance = invoiceRows.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const latestHoneyBook = honeybookReferences[0] ?? null;
  const latestProposalId = proposalRows[0]?.id ?? null;
  const latestOpenInvoiceId = invoiceRows.find((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.status !== "refunded")?.id ?? null;
  const stageLabel =
    project.pipeline_stage && project.pipeline_stage in pipelineStageLabels
      ? pipelineStageLabels[project.pipeline_stage as keyof typeof pipelineStageLabels]
      : project.pipeline_stage ?? "Lead Received";

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Production · {project.project_number}</span>
          <h1>{project.event_name}</h1>
          <p className="mini-meta">{clientName} · {project.event_type} · {formatDate(project.event_date, "Date pending")} · {project.venue_name || "Venue pending"} · Pipeline: {stageLabel}</p>
        </div>
        <div className="topbar-actions">
          {client ? <ButtonLink href={`/admin/clients/${client.id}`} variant="light">Open Client</ButtonLink> : null}
          <ButtonLink href="/admin/invoices" variant="light">Create Invoice</ButtonLink>
          {(project.honeybook_url || latestHoneyBook?.honeybook_url) ? (
            <a className="btn btn-light" href={project.honeybook_url || latestHoneyBook?.honeybook_url || "#"} rel="noreferrer" target="_blank">
              <ExternalLink size={16} /> Open in HoneyBook
            </a>
          ) : null}
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="panel span-2">
          <h2>Event Details</h2>
          <dl className="resource-details">
            <div><dt>Event Date</dt><dd>{formatDate(project.event_date, "Date pending")}</dd></div>
            <div><dt>Venue</dt><dd>{project.venue_name || "Not set"}</dd></div>
            <div><dt>Address</dt><dd>{project.venue_address || "Not set"}</dd></div>
            <div><dt>City</dt><dd>{project.city || "Not set"}</dd></div>
            <div><dt>Guest Count</dt><dd>{project.guest_count ?? "Not set"}</dd></div>
            <div><dt>Budget</dt><dd>{project.budget || "Not set"}</dd></div>
            <div><dt>Color Palette</dt><dd>{project.color_palette || "Not set"}</dd></div>
            <div><dt>Theme</dt><dd>{project.theme || "Not set"}</dd></div>
            <div><dt>Client Email</dt><dd>{clientProfile?.email || "Not set"}</dd></div>
            <div><dt>Client Phone</dt><dd>{clientProfile?.phone || "Not set"}</dd></div>
          </dl>

          <h2 style={{ marginTop: 22 }}>Status</h2>
          <form action={`/admin/projects/${projectId}`} method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="hidden" name="action" value="status" />
            <select className="input" defaultValue={project.status} name="status" style={{ maxWidth: 260, padding: "8px 10px" }}>
              {projectStatuses.map((option) => (
                <option key={option} value={option}>{projectStatusLabels[option]}</option>
              ))}
            </select>
            <button className="btn btn-secondary" type="submit">Update Status</button>
          </form>
        </section>

        <section className="panel">
          <h2>HoneyBook Pipeline</h2>
          <ProjectPipelineActions
            invoiceId={latestOpenInvoiceId}
            pipelineStage={project.pipeline_stage}
            projectId={projectId}
            proposalId={latestProposalId}
          />
          <p className="mini-meta" style={{ marginTop: 12 }}>
            In-app proposals, invoices, and manual payments stay available. HoneyBook is an optional external workspace link.
          </p>
        </section>

        <section className="panel">
          <h2>Billing Summary</h2>
          <ul className="list">
            <li><span>Invoices</span><strong>{invoiceRows.length}</strong></li>
            <li><span>Outstanding Balance</span><strong>{currency(balance)}</strong></li>
            <li><span>HoneyBook Refs</span><strong>{honeybookReferences.length}</strong></li>
            <li><span>Invoice Reference</span><strong>{latestHoneyBook?.honeybook_invoice_number ?? "Not linked"}</strong></li>
            <li><span>HoneyBook Status</span><span className="status">{latestHoneyBook?.invoice_status ?? "Not linked"}</span></li>
            {proposalRows.map((proposal) => (
              <li key={proposal.id}><span>Proposal {proposal.proposal_number}</span><span className="status">{proposal.status}</span></li>
            ))}
            {contracts?.map((contract) => (
              <li key={contract.id}><span>Contract {contract.contract_number}</span><span className="status">{contract.status}</span></li>
            ))}
          </ul>
        </section>

        <section className="panel span-2">
          <h2>Invoices</h2>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {invoiceRows.map((invoice) => (
                <tr key={invoice.id}>
                  <td><a href={`/admin/invoices/${invoice.id}`}>{invoice.invoice_number}</a></td>
                  <td>{currency(Number(invoice.total ?? 0))}</td>
                  <td>{currency(Number(invoice.balance_due ?? 0))}</td>
                  <td><span className="status">{invoice.status}</span></td>
                </tr>
              ))}
              {!invoiceRows.length ? <tr><td colSpan={4}>No invoices created for this project yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="panel span-2">
          <h2>Import HoneyBook Financial Reference</h2>
          {client?.id ? (
            <HoneyBookReferenceForm
              clientId={client.id}
              initialHoneyBookUrl={project.honeybook_url ?? latestHoneyBook?.honeybook_url}
              projectId={projectId}
            />
          ) : (
            <p className="mini-meta">A client record is required before a HoneyBook reference can be linked.</p>
          )}
        </section>

        <section className="panel span-2">
          <h2>HoneyBook Reference History</h2>
          <table className="table">
            <thead><tr><th>Reference</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {honeybookReferences.map((reference) => (
                <tr key={reference.id}>
                  <td>{reference.honeybook_invoice_number ?? reference.honeybook_project_id ?? "HoneyBook reference"}</td>
                  <td>{reference.invoice_total != null ? currency(Number(reference.invoice_total)) : "—"}</td>
                  <td>{reference.amount_paid != null ? currency(Number(reference.amount_paid)) : "—"}</td>
                  <td>{reference.balance_remaining != null ? currency(Number(reference.balance_remaining)) : "—"}</td>
                  <td><span className="status">{reference.invoice_status ?? "unknown"}</span></td>
                  <td>{formatDateTime(reference.updated_at)}</td>
                  <td>
                    {reference.honeybook_url ? (
                      <a className="btn btn-light" href={reference.honeybook_url} rel="noreferrer" target="_blank">
                        <ExternalLink size={15} /> Open
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {!honeybookReferences.length ? <tr><td colSpan={7}>No HoneyBook reference has been linked to this project yet.</td></tr> : null}
            </tbody>
          </table>
        </section>

        <section className="panel">
          <h2>Tasks</h2>
          <ul className="list">
            {taskRows.map((task) => (
              <li key={task.id}>
                <span>{task.title}<span className="mini-meta">{task.due_date ? formatDateTime(task.due_date) : "No due date"} · {task.priority}</span></span>
                <ButtonLink
                  href={`/admin/projects/${projectId}?action=${task.status === "complete" ? "reopen-task" : "complete-task"}&id=${task.id}`}
                  variant="light"
                >
                  {task.status === "complete" ? "Reopen" : "Complete"}
                </ButtonLink>
              </li>
            ))}
            {!taskRows.length ? <li>No tasks assigned to this project.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
