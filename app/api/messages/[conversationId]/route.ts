import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { canAccessConversation } from "@/lib/auth/conversation-access";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id,bpd_clients!client_id(profile_id),bpd_projects!project_id(assigned_admin_id)")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    console.error("conversation_lookup_failed", { conversationId, code: conversationError.code, message: conversationError.message });
    return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
  }

  const client = Array.isArray(conversation?.bpd_clients) ? conversation?.bpd_clients[0] : conversation?.bpd_clients;
  const project = Array.isArray(conversation?.bpd_projects) ? conversation?.bpd_projects[0] : conversation?.bpd_projects;
  const canAccess = canAccessConversation({
    role: profile.role,
    profileId: profile.id,
    clientProfileId: client?.profile_id,
    assignedAdminId: project?.assigned_admin_id,
  });

  if (!conversation || !canAccess) {
    return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("message_list_failed", { conversationId, code: error.code, message: error.message });
    return NextResponse.json({ success: false, message: "Unable to load messages." }, { status: 400 });
  }
  return NextResponse.json({ success: true, messages: data });
}
