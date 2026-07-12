import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ recipientId: z.string().uuid().optional() });

export async function POST(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const { recipientId: requestedRecipientId } = schema.parse(await request.json().catch(() => ({})));
  const recipientId = adminRoles.has(profile.role) && requestedRecipientId ? requestedRecipientId : profile.id;
  const { error } = await createAdminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .is("read_at", null);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
