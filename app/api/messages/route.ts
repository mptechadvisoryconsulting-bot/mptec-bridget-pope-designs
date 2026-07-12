import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageSchema } from "@/lib/validation/message-schema";

export async function POST(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const input = messageSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id,project_id,client_id,bpd_clients(profile_id),bpd_projects(assigned_admin_id)")
    .eq("id", input.conversationId)
    .maybeSingle();

  const client = Array.isArray(conversation?.bpd_clients) ? conversation?.bpd_clients[0] : conversation?.bpd_clients;
  const project = Array.isArray(conversation?.bpd_projects) ? conversation?.bpd_projects[0] : conversation?.bpd_projects;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;

  if (!conversation || !canAccess) {
    return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: profile.id,
      body: input.body,
      attachment_file_id: input.attachmentFileId,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

  const recipientId = adminRoles.has(profile.role) ? client?.profile_id : project?.assigned_admin_id;
  if (recipientId && recipientId !== profile.id) {
    await supabase.from("notifications").insert({
      recipient_id: recipientId,
      project_id: conversation.project_id,
      type: "message_received",
      title: adminRoles.has(profile.role) ? "Planner message received" : "Client message received",
      message: adminRoles.has(profile.role)
        ? "Bridget Pope Designs sent a project message."
        : `${profile.first_name ?? "Client"} sent a project message.`,
      action_url: adminRoles.has(profile.role) ? "/client/messages" : "/admin/messages",
    });
  }

  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", input.conversationId);

  return NextResponse.json({ success: true, message: data }, { status: 201 });
}
