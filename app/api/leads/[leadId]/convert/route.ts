import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { provisionClientFromLead } from "@/lib/provisioning/provision-client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { leadId } = await params;
  const result = await provisionClientFromLead(createAdminClient(), {
    leadId,
    actorId: admin.profile.id,
    // Create the internal profile/client/project/conversation needed for proposals,
    // but do not invite the prospect into the portal until approval.
    inviteToPortal: false,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    idempotent: result.idempotent,
    profileId: result.profileId,
    clientId: result.clientId,
    projectId: result.projectId,
    conversationId: result.conversationId,
    authUserId: result.authUserId ?? null,
    created: result.created,
    warning: result.warning,
  });
}
