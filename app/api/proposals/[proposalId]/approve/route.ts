import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { runPipelineAction } from "@/lib/admin/pipeline";
import { createDraftInvoiceFromProposal } from "@/lib/billing/create-invoice-from-proposal";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  // Avoid nested embeds here: ambiguous PostgREST relationships on bpd_proposals→bpd_projects
  // previously returned HTTP 300, which surfaced as a false "Proposal not found" 404.
  const { data: existing, error: proposalLookupError } = await supabase
    .from("proposals")
    .select("id,project_id,status")
    .eq("id", proposalId)
    .maybeSingle();
  if (proposalLookupError) {
    console.error("proposal_lookup_failed", { proposalId, code: proposalLookupError.code, message: proposalLookupError.message });
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }
  if (!existing) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  const { data: project, error: projectLookupError } = await supabase
    .from("projects")
    .select("id,assigned_admin_id,client_id,lead_id")
    .eq("id", existing.project_id)
    .maybeSingle();
  if (projectLookupError) {
    console.error("proposal_project_lookup_failed", {
      proposalId,
      projectId: existing.project_id,
      code: projectLookupError.code,
      message: projectLookupError.message,
    });
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  let canApprove = adminRoles.has(profile.role);
  if (!canApprove && project) {
    if (project.assigned_admin_id === profile.id) {
      canApprove = true;
    } else if (project.client_id) {
      const { data: client, error: clientLookupError } = await supabase
        .from("clients")
        .select("profile_id")
        .eq("id", project.client_id)
        .maybeSingle();
      if (clientLookupError) {
        console.error("proposal_client_lookup_failed", {
          proposalId,
          clientId: project.client_id,
          code: clientLookupError.code,
          message: clientLookupError.message,
        });
        return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
      }
      canApprove = client?.profile_id === profile.id;
    }
  }

  if (!canApprove) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  // Prefer full pipeline when project is available (provisions client + creates draft invoice).
  if (project?.id) {
    const result = await runPipelineAction(supabase, project.id, {
      action: "proposal_approved",
      actorId: profile.id,
      proposalId,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message ?? "Unable to approve proposal." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      proposal: { id: proposalId, project_id: project.id, status: "approved" },
      provisioned: result.provisioned,
      invoiceId: result.invoiceId,
      invoiceCreated: result.invoiceCreated,
      warning: result.warning,
      message: result.message,
    });
  }

  const { data, error } = await supabase
    .from("proposals")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", proposalId)
    .select("id,project_id")
    .single();
  if (error) {
    console.error("proposal_approve_failed", { proposalId, code: error.code, message: error.message });
    return NextResponse.json({ success: false, message: "Unable to approve proposal." }, { status: 400 });
  }

  let invoiceId: string | undefined;
  let invoiceCreated = false;
  let warning: string | undefined;

  if (data.project_id) {
    const { data: fallbackProject } = await supabase
      .from("projects")
      .select("id,client_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (fallbackProject?.client_id) {
      const invoiceResult = await createDraftInvoiceFromProposal(supabase, {
        proposalId,
        projectId: fallbackProject.id,
        clientId: fallbackProject.client_id,
        actorId: profile.id,
      });
      if (invoiceResult.success) {
        invoiceId = invoiceResult.invoiceId;
        invoiceCreated = invoiceResult.created;
      } else {
        warning = invoiceResult.message;
      }
    }
  }

  await supabase.from("activity_logs").insert({
    project_id: data.project_id,
    action: "proposal_approved",
    entity_type: "proposal",
    entity_id: data.id,
    metadata: { invoiceId: invoiceId ?? null, invoiceCreated },
  });

  return NextResponse.json({
    success: true,
    proposal: data,
    invoiceId,
    invoiceCreated,
    warning,
  });
}
