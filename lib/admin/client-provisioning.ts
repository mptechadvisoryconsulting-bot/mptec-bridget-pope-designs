import { z } from "zod";
import { clientAuthRedirectUrl } from "@/lib/auth/client-invite";
import { normalizeUsername } from "@/lib/auth/portal-credentials";

export const clientAccountSchema = z.object({
  email: z.string().email().max(160),
  username: z.string().min(3).max(40).optional().or(z.literal("")),
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  phone: z.string().max(30).optional().or(z.literal("")),
  eventName: z.string().min(2).max(160),
  eventType: z.string().min(2).max(100),
  eventDate: z.string().optional().or(z.literal("")),
  venue: z.string().max(200).optional().or(z.literal("")),
  status: z
    .enum(["pending", "booked", "planning", "design_in_progress", "awaiting_client_approval", "finalizing", "ready_for_event", "event_complete"])
    .default("planning"),
});

export type ClientAccountInput = z.infer<typeof clientAccountSchema>;

export type SupabaseAdminLike = {
  from(table: string): any;
  auth: {
    admin: {
      inviteUserByEmail: (email: string, options?: { data?: object; redirectTo?: string }) => Promise<{ data: any; error: any }>;
      deleteUser: (id: string) => Promise<{ data: any; error: any }>;
    };
  };
};

export type ProvisionClientAccountResult =
  | {
      success: true;
      email: string;
      username: string | null;
      authUserId: string;
      profileId: string;
      clientId: string;
      projectId: string;
      conversationId: string;
      warning?: string;
    }
  | {
      success: false;
      status: number;
      message: string;
    };

function deriveUsername(email: string, requested?: string) {
  const raw = requested && requested.trim() ? requested : email.split("@")[0] ?? "";
  const normalized = normalizeUsername(raw);
  return normalized || null;
}

export async function provisionClientAccount(
  supabase: SupabaseAdminLike,
  input: ClientAccountInput & { adminProfileId: string },
): Promise<ProvisionClientAccountResult> {
  const email = input.email.trim().toLowerCase();
  const username = deriveUsername(email, input.username);

  const { data: existingEmail } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (existingEmail) {
    return { success: false, status: 409, message: "A client with that email already has a portal account." };
  }

  if (username) {
    const { data: existingUsername } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
    if (existingUsername) {
      return { success: false, status: 409, message: "That username is already in use." };
    }
  }

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      username,
      first_name: input.firstName,
      last_name: input.lastName,
      role: "client",
    },
    redirectTo: clientAuthRedirectUrl(),
  });

  const authUserId: string | undefined = inviteData?.user?.id;

  if (inviteError || !authUserId) {
    return { success: false, status: 400, message: inviteError?.message ?? "Unable to invite the client. Please try again." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: authUserId,
      username,
      role: "client",
      first_name: input.firstName,
      last_name: input.lastName,
      email,
      phone: input.phone || null,
      active: true,
      portal_created_by: input.adminProfileId,
      portal_created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    await supabase.auth.admin.deleteUser(authUserId);
    return {
      success: false,
      status: 400,
      message: profileError?.message ?? "Unable to create the client profile. The invitation has been cancelled.",
    };
  }

  const { data: client, error: clientError } = await supabase.from("clients").insert({ profile_id: profile.id }).select("id").single();

  if (clientError || !client) {
    await supabase.from("profiles").delete().eq("id", profile.id);
    await supabase.auth.admin.deleteUser(authUserId);
    return {
      success: false,
      status: 400,
      message: clientError?.message ?? "Unable to create the client record. The invitation has been cancelled.",
    };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_id: client.id,
      event_name: input.eventName,
      event_type: input.eventType,
      event_date: input.eventDate || null,
      venue_name: input.venue || null,
      status: input.status,
      assigned_admin_id: input.adminProfileId,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    await supabase.from("clients").delete().eq("id", client.id);
    await supabase.from("profiles").delete().eq("id", profile.id);
    await supabase.auth.admin.deleteUser(authUserId);
    return {
      success: false,
      status: 400,
      message: projectError?.message ?? "Unable to create the project. The invitation has been cancelled.",
    };
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({ project_id: project.id, client_id: client.id })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    await supabase.from("projects").delete().eq("id", project.id);
    await supabase.from("clients").delete().eq("id", client.id);
    await supabase.from("profiles").delete().eq("id", profile.id);
    await supabase.auth.admin.deleteUser(authUserId);
    return {
      success: false,
      status: 400,
      message: conversationError?.message ?? "Unable to set up client messaging. The invitation has been cancelled.",
    };
  }

  const { error: notificationError } = await supabase.from("notifications").insert({
    recipient_id: profile.id,
    project_id: project.id,
    type: "portal_created",
    title: "Your client portal is ready",
    message: "Bridget Pope Designs sent you an invitation to set up your project workspace.",
    action_url: "/client/dashboard",
  });

  if (notificationError) {
    console.error("client_account_notification_failed", {
      operation: "client_account_create",
      profileId: profile.id,
      code: notificationError?.code,
    });
  }

  return {
    success: true,
    email,
    username,
    authUserId,
    profileId: profile.id,
    clientId: client.id,
    projectId: project.id,
    conversationId: conversation.id,
    warning: notificationError ? "The client account was created, but the welcome notification could not be delivered." : undefined,
  };
}
