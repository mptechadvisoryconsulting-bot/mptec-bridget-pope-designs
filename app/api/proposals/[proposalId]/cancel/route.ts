import { NextResponse } from "next/server";
import { canCancelProposal } from "@/lib/billing/document-actions";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { proposalId } = await params;
  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select("id,status,project_id,proposal_number,title")
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  if (!canCancelProposal(String(proposal.status))) {
    return NextResponse.json(
      {
        success: false,
        message:
          proposal.status === "approved"
            ? "Approved proposals cannot be cancelled. Create a revision instead."
            : `Proposals with status "${proposal.status}" cannot be cancelled.`,
      },
      { status: 400 },
    );
  }

  const { data: updated, error } = await supabase
    .from("proposals")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", proposalId)
    .select("id,status,proposal_number")
    .single();

  if (error || !updated) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to cancel proposal." }, { status: 400 });
  }

  await supabase.from("activity_logs").insert({
    actor_id: admin.profile.id,
    project_id: proposal.project_id,
    action: "proposal_cancelled",
    entity_type: "proposal",
    entity_id: proposalId,
    metadata: {
      proposal_number: proposal.proposal_number,
      previous_status: proposal.status,
      title: proposal.title,
    },
  });

  return NextResponse.json({ success: true, proposal: updated, message: "Proposal cancelled." });
}
