import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,bpd_clients(profile_id),bpd_projects(assigned_admin_id)")
    .eq("id", conversationId)
    .maybeSingle();

  const client = Array.isArray(conversation?.bpd_clients) ? conversation?.bpd_clients[0] : conversation?.bpd_clients;
  const project = Array.isArray(conversation?.bpd_projects) ? conversation?.bpd_projects[0] : conversation?.bpd_projects;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;

  if (!conversation || !canAccess) {
    return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, messages: data });
}
