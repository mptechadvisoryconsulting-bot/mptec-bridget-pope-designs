import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getRequestIp, rateLimit } from "@/lib/http";
import { canClientActOnProposal, clientProposalResponseSchema } from "@/lib/proposals/client-response";
import { notifyProposalResponseOwners } from "@/lib/proposals/response-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active || profile.role !== "client") {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const limiter = rateLimit(`proposal-response:${profile.id}:${getRequestIp(request)}`, 10, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ success: false, message: "Too many proposal responses. Please wait and try again." }, { status: 429 });
  }

  const parsed = clientProposalResponseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid proposal response." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id,project_id,status,proposal_number,title")
    .eq("id", proposalId)
    .maybeSingle();

  if (proposalError) {
    console.error("proposal_response_lookup_failed", { proposalId, code: proposalError.code, message: proposalError.message });
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }
  if (!proposal) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  if (!canClientActOnProposal(proposal.status)) {
    return NextResponse.json({ success: false, message: "This proposal is no longer awaiting a response." }, { status: 409 });
  }
  if (parsed.data.action === "changes_requested" && proposal.status === "changes_requested") {
    return NextResponse.json(
      { success: false, message: "Changes have already been requested. Continue the conversation in Messages." },
      { status: 409 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,client_id,assigned_admin_id,event_name")
    .eq("id", proposal.project_id)
    .maybeSingle();
  if (projectError || !project?.client_id) {
    if (projectError) {
      console.error("proposal_response_project_lookup_failed", {
        proposalId,
        projectId: proposal.project_id,
        code: projectError.code,
        message: projectError.message,
      });
    }
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("profile_id")
    .eq("id", project.client_id)
    .maybeSingle();
  if (clientError || client?.profile_id !== profile.id) {
    if (clientError) {
      console.error("proposal_response_client_lookup_failed", { proposalId, clientId: project.client_id, code: clientError.code, message: clientError.message });
    }
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const note = parsed.data.note?.trim() || null;
  const { error: updateError } = await supabase
    .from("proposals")
    .update({ status: parsed.data.action, approved_at: null, updated_at: now })
    .eq("id", proposal.id)
    .eq("project_id", project.id);

  if (updateError) {
    console.error("proposal_response_update_failed", { proposalId, code: updateError.code, message: updateError.message });
    return NextResponse.json({ success: false, message: "Unable to save your proposal response." }, { status: 400 });
  }

  await supabase.from("activity_logs").insert({
    actor_id: profile.id,
    project_id: project.id,
    action: parsed.data.action === "changes_requested" ? "proposal_changes_requested" : "proposal_rejected",
    entity_type: "proposal",
    entity_id: proposal.id,
    metadata: { note, response: parsed.data.action },
  });

  if (parsed.data.action === "changes_requested" && note) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("project_id", project.id)
      .eq("client_id", project.client_id)
      .maybeSingle();

    if (conversation?.id) {
      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: profile.id,
        body: `Proposal change request — ${proposal.proposal_number ?? proposal.title ?? "Proposal"}:\n${note}`,
      });
      if (messageError) {
        console.error("proposal_response_message_failed", { proposalId, conversationId: conversation.id, code: messageError.code, message: messageError.message });
      } else {
        await supabase.from("conversations").update({ updated_at: now }).eq("id", conversation.id);
      }
    }
  }

  await notifyProposalResponseOwners({
    supabase,
    projectId: project.id,
    proposalId: proposal.id,
    assignedAdminId: project.assigned_admin_id,
    eventName: project.event_name,
    proposalLabel: proposal.title ?? proposal.proposal_number,
    response: parsed.data.action,
  });

  return NextResponse.json({
    success: true,
    proposal: { id: proposal.id, status: parsed.data.action },
  });
}
