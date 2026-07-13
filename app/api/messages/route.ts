import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { appUrl } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { getRequestIp, rateLimit } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { messageSchema } from "@/lib/validation/message-schema";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

type ClientProfile = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/**
 * Best-effort email notification for a newly sent message. Failures here are logged but never
 * fail the request — the message itself is already persisted and visible in-app.
 */
async function notifyMessageRecipientByEmail(input: {
  supabase: SupabaseAdmin;
  isAdminSender: boolean;
  senderName: string;
  clientProfile: ClientProfile | null;
  projectEventName?: string | null;
}) {
  const { supabase, isAdminSender, senderName, clientProfile, projectEventName } = input;

  try {
    const { data: settings } = await supabase
      .from("business_settings")
      .select("id,owner_message_notification_email,client_email_notifications_enabled")
      .limit(1)
      .maybeSingle();

    if (isAdminSender) {
      if (!clientProfile?.email || settings?.client_email_notifications_enabled === false) return;
      await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: clientProfile.email,
        subject: `New message about ${projectEventName ?? "your event"}`,
        html: `
          <p>Hello ${clientProfile.first_name ?? "there"},</p>
          <p>Bridget Pope Designs sent you a new message about ${projectEventName ?? "your event"}.</p>
          <p><a href="${appUrl()}/client/messages">View your messages</a></p>
        `,
      });
      return;
    }

    if (!settings?.owner_message_notification_email) return;
    await sendTrackedEmail({
      supabase,
      settingsId: settings?.id,
      from: emailFrom(),
      to: settings.owner_message_notification_email,
      subject: `New client message${projectEventName ? `: ${projectEventName}` : ""}`,
      html: `
        <p>${senderName} sent a new project message${projectEventName ? ` about ${projectEventName}` : ""}.</p>
        <p><a href="${appUrl()}/admin/messages">View in admin dashboard</a></p>
      `,
    });
  } catch (error) {
    console.error("Message email notification failed", error instanceof Error ? error.message : error);
  }
}

export async function POST(request: Request) {
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const limiter = rateLimit(`messages:${profile.id}:${getRequestIp(request)}`, 20, 60_000);
  if (!limiter.allowed) {
    return NextResponse.json({ success: false, message: "Too many messages sent. Please wait a moment and try again." }, { status: 429 });
  }

  let input: z.infer<typeof messageSchema>;
  try {
    input = messageSchema.parse(await request.json());
  } catch (error) {
    const parseMessage = error instanceof z.ZodError ? error.issues[0]?.message ?? "Invalid message." : "Invalid message.";
    return NextResponse.json({ success: false, message: parseMessage }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: conversation, error: conversationLookupError } = await supabase
    .from("conversations")
    .select("id,project_id,client_id,bpd_clients(profile_id,bpd_profiles(email,first_name,last_name)),bpd_projects(assigned_admin_id,event_name)")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationLookupError) {
    return NextResponse.json({ success: false, message: "Unable to load conversation." }, { status: 400 });
  }

  const client = Array.isArray(conversation?.bpd_clients) ? conversation?.bpd_clients[0] : conversation?.bpd_clients;
  const clientProfile = (Array.isArray(client?.bpd_profiles) ? client?.bpd_profiles[0] : client?.bpd_profiles) as ClientProfile | null;
  const project = Array.isArray(conversation?.bpd_projects) ? conversation?.bpd_projects[0] : conversation?.bpd_projects;
  const isAdminSender = adminRoles.has(profile.role);
  const canAccess = isAdminSender || client?.profile_id === profile.id || project?.assigned_admin_id === profile.id;

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

  if (error || !data) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to send message." }, { status: 400 });
  }

  const recipientId = isAdminSender ? client?.profile_id : project?.assigned_admin_id;
  if (recipientId && recipientId !== profile.id) {
    const { error: notificationError } = await supabase.from("notifications").insert({
      recipient_id: recipientId,
      project_id: conversation.project_id,
      type: "message_received",
      title: isAdminSender ? "Planner message received" : "Client message received",
      message: isAdminSender
        ? "Bridget Pope Designs sent a project message."
        : `${profile.first_name ?? "Client"} sent a project message.`,
      action_url: isAdminSender ? "/client/messages" : `/admin/messages?conversation=${input.conversationId}`,
    });

    if (notificationError) {
      console.error("Failed to insert message notification", { conversationId: input.conversationId, code: notificationError.code, message: notificationError.message });
    }
  }

  const { error: conversationUpdateError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", input.conversationId);

  if (conversationUpdateError) {
    console.error("Failed to update conversation timestamp", { conversationId: input.conversationId, code: conversationUpdateError.code, message: conversationUpdateError.message });
  }

  await notifyMessageRecipientByEmail({
    supabase,
    isAdminSender,
    senderName: [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "A client",
    clientProfile,
    projectEventName: project?.event_name,
  });

  return NextResponse.json({ success: true, message: data }, { status: 201 });
}
