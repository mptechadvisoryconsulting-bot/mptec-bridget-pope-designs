import { NextResponse } from "next/server";
import { clientAccountSchema, provisionClientAccount } from "@/lib/admin/client-provisioning";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  let input;
  try {
    input = clientAccountSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Please check the client details and try again." }, { status: 400 });
  }

  const result = await provisionClientAccount(createAdminClient(), { ...input, adminProfileId: admin.profile.id });

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json(
    {
      success: true,
      email: result.email,
      username: result.username,
      authUserId: result.authUserId,
      profileId: result.profileId,
      clientId: result.clientId,
      projectId: result.projectId,
      conversationId: result.conversationId,
      message: `Invitation sent to ${result.email}.`,
      warning: result.warning,
    },
    { status: 201 },
  );
}
