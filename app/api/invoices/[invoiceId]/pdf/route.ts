import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { buildInvoiceRenderModel } from "@/lib/invoices/render-model";
import { generateInvoicePdf } from "@/lib/pdf/generate-invoice-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

function notFound() {
  return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
}

export async function GET(request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { profile } = await getCurrentProfile();

  if (!profile?.active) return notFound();

  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "*, bpd_invoice_items(*), bpd_projects(id,client_id,event_name,venue_name,bpd_clients(profile_id,bpd_profiles(first_name,last_name,email,username)))",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return notFound();

  const project = Array.isArray(invoice.bpd_projects) ? invoice.bpd_projects[0] : invoice.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const isAdmin = adminRoles.has(profile.role);
  const isOwningClient = client?.profile_id === profile.id;

  if (!isAdmin && !isOwningClient) return notFound();
  if (!isAdmin && invoice.status === "draft") return notFound();

  const clientProfile = Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles;
  const clientName = [clientProfile?.first_name, clientProfile?.last_name].filter(Boolean).join(" ") || clientProfile?.email || "Client";

  const url = new URL(request.url);
  const requestedVersion = url.searchParams.get("version");
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";

  let renderInvoice = invoice;
  let renderItems = invoice.bpd_invoice_items ?? [];
  let versionNumber = Number(invoice.active_version ?? 1) || 1;

  if (requestedVersion) {
    const { data: versionRow } = await supabase
      .from("invoice_versions")
      .select("version_number,template_snapshot,invoice_snapshot")
      .eq("invoice_id", invoiceId)
      .eq("version_number", Number(requestedVersion))
      .maybeSingle();

    if (!versionRow) return notFound();

    const snapshot = (versionRow.invoice_snapshot ?? {}) as { invoice?: Record<string, unknown>; items?: unknown[] };
    renderInvoice = {
      ...invoice,
      ...(snapshot.invoice ?? {}),
      template_snapshot: versionRow.template_snapshot,
    };
    renderItems = (snapshot.items ?? []) as typeof renderItems;
    versionNumber = versionRow.version_number;
  }

  const model = buildInvoiceRenderModel({
    invoice: renderInvoice,
    items: renderItems,
    clientName,
    clientEmail: clientProfile?.email,
    projectName: project?.event_name,
    venue: project?.venue_name,
    versionNumber,
  });

  const pdf = await generateInvoicePdf(model);

  if (isAdmin) {
    await supabase.from("activity_logs").insert({
      actor_id: profile.id,
      project_id: project?.id ?? null,
      action: "invoice_pdf_downloaded",
      entity_type: "invoice",
      entity_id: invoiceId,
      metadata: { invoice_number: invoice.invoice_number, version: versionNumber },
    });
  }

  return new Response(new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="Invoice-${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
