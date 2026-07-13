import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { markThreadReadSchema } from "@/lib/validation/message-schema";

export async function PATCH(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let input: z.infer<typeof markThreadReadSchema>;
  try {
    input = markThreadReadSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: conversation, error: conversationLookupError } = await supabase
    .from("conversations")
    .select("id,bpd_clients(profile_id),bpd_projects(assigned_admin_id)")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationLookupError) {
    return NextResponse.json({ success: false, message: "Unable to load conversation." }, { status: 400 });
  }

  const client = Array.isArray(conversation?.bpd_clients) ? conversation?.bpd_clients[0] : conversation?.bpd_clients;
  const project = Array.isArray(conversation?.bpd_projects) ? conversation?.bpd_projects[0] : conversation?.bpd_projects;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;

  if (!conversation || !canAccess) {
    return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", input.conversationId)
    .neq("sender_id", profile.id)
    .is("read_at", null)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, markedCount: data?.length ?? 0 });
}
