import { clientAuthRedirectUrl } from "@/lib/auth/client-invite";
import { normalizeUsername } from "@/lib/auth/portal-credentials";
import {
  clientAccountSchema,
  type ClientAccountInput,
  type ProvisionClientAccountResult,
  type SupabaseAdminLike,
} from "@/lib/admin/client-provisioning";

export type LeadProvisionInput = {
  leadId: string;
  actorId?: string | null;
  inviteToPortal?: boolean;
};

export type ProvisionCreatedFlags = {
  profile: boolean;
  client: boolean;
  project: boolean;
  conversation: boolean;
  authInvite: boolean;
};

export type ProvisionClientSuccess = {
  success: true;
  profileId: string;
  clientId: string;
  projectId: string;
  conversationId: string;
  authUserId?: string;
  idempotent: boolean;
  created: ProvisionCreatedFlags;
  email?: string;
  username?: string | null;
  warning?: string;
};

export type ProvisionClientFailure = {
  success: false;
  status: number;
  message: string;
};

export type ProvisionClientResult = ProvisionClientSuccess | ProvisionClientFailure;

type AuthAdminLike = SupabaseAdminLike["auth"]["admin"] & {
  listUsers?: (params?: { page?: number; perPage?: number }) => Promise<{ data: any; error: any }>;
};

function deriveUsername(email: string, requested?: string) {
  const raw = requested && requested.trim() ? requested : email.split("@")[0] ?? "";
  const normalized = normalizeUsername(raw);
  return normalized || null;
}

function alreadyRegisteredMessage(message?: string | null) {
  const text = String(message ?? "").toLowerCase();
  return (
    text.includes("already been registered") ||
    text.includes("already registered") ||
    text.includes("user already exists") ||
    text.includes("already exists")
  );
}

async function findAuthUserIdByEmail(supabase: SupabaseAdminLike, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const admin = supabase.auth.admin as AuthAdminLike;
  if (typeof admin.listUsers !== "function") return null;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const users = data?.users ?? [];
    const match = users.find((user: { email?: string | null; id?: string }) => user.email?.toLowerCase() === normalized);
    if (match?.id) return match.id;
    if (users.length < 200) break;
  }

  return null;
}

async function inviteOrLinkAuthUser(
  supabase: SupabaseAdminLike,
  input: {
    email: string;
    firstName: string;
    lastName: string;
    username?: string | null;
    profileId?: string | null;
    failHard?: boolean;
  },
): Promise<{ authUserId?: string; invited: boolean; warning?: string; error?: string }> {
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(input.email, {
    data: {
      username: input.username ?? null,
      first_name: input.firstName,
      last_name: input.lastName,
      role: "client",
    },
    redirectTo: clientAuthRedirectUrl(),
  });

  let authUserId: string | undefined = inviteData?.user?.id;
  let invited = Boolean(authUserId);

  if (inviteError || !authUserId) {
    if (alreadyRegisteredMessage(inviteError?.message)) {
      authUserId = (await findAuthUserIdByEmail(supabase, input.email)) ?? undefined;
      invited = false;
    } else if (input.failHard) {
      return { invited: false, error: inviteError?.message ?? "Unable to invite the client. Please try again." };
    } else {
      return { warning: inviteError?.message ?? "Portal invitation could not be sent.", invited: false };
    }
  }

  if (authUserId && input.profileId) {
    await supabase.from("profiles").update({ auth_user_id: authUserId }).eq("id", input.profileId);
  }

  return { authUserId, invited, warning: undefined };
}

async function findProfileByEmail(supabase: SupabaseAdminLike, email: string) {
  const normalized = email.trim().toLowerCase();
  const { data: exact } = await supabase.from("profiles").select("*").eq("email", normalized).maybeSingle();
  if (exact) return exact;

  const { data: insensitive } = await supabase.from("profiles").select("*").ilike("email", normalized).limit(1).maybeSingle();
  return insensitive ?? null;
}

export async function provisionClientFromLead(
  supabase: SupabaseAdminLike,
  input: LeadProvisionInput,
): Promise<ProvisionClientResult> {
  const inviteToPortal = input.inviteToPortal !== false;
  const created: ProvisionCreatedFlags = {
    profile: false,
    client: false,
    project: false,
    conversation: false,
    authInvite: false,
  };

  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", input.leadId).maybeSingle();
  if (leadError || !lead) {
    return { success: false, status: 404, message: leadError?.message ?? "Lead not found." };
  }

  const email = String(lead.email ?? "").trim().toLowerCase();
  let idempotent = false;
  let warning: string | undefined;
  let authUserId: string | undefined;

  let { data: client } = await supabase
    .from("clients")
    .select("id,profile_id,lead_id,active_project_id")
    .eq("lead_id", input.leadId)
    .maybeSingle();

  let profile =
    client?.profile_id
      ? (await supabase.from("profiles").select("*").eq("id", client.profile_id).maybeSingle()).data
      : null;

  if (!client) {
    profile = await findProfileByEmail(supabase, email);
    if (profile?.id) {
      const { data: profileClient } = await supabase
        .from("clients")
        .select("id,profile_id,lead_id,active_project_id")
        .eq("profile_id", profile.id)
        .maybeSingle();
      client = profileClient;
    }
  } else {
    idempotent = true;
  }

  const existingAuthUserId = await findAuthUserIdByEmail(supabase, email);
  if (existingAuthUserId) {
    authUserId = existingAuthUserId;
    if (profile?.id && !profile.auth_user_id) {
      await supabase.from("profiles").update({ auth_user_id: existingAuthUserId }).eq("id", profile.id);
      profile = { ...profile, auth_user_id: existingAuthUserId };
    }
  }

  if (!profile) {
    if (inviteToPortal) {
      const invite = await inviteOrLinkAuthUser(supabase, {
        email,
        firstName: lead.first_name,
        lastName: lead.last_name,
        failHard: false,
      });
      authUserId = invite.authUserId ?? authUserId;
      created.authInvite = invite.invited;
      if (invite.warning) warning = invite.warning;
    }

    const { data: createdProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authUserId ?? null,
        role: "client",
        first_name: lead.first_name,
        last_name: lead.last_name,
        email,
        phone: lead.phone,
        active: true,
        portal_created_by: input.actorId ?? null,
        portal_created_at: authUserId ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (profileError || !createdProfile) {
      if (created.authInvite && authUserId) {
        await supabase.auth.admin.deleteUser(authUserId);
      }
      return { success: false, status: 400, message: profileError?.message ?? "Unable to create client profile." };
    }

    profile = createdProfile;
    created.profile = true;
  } else if (inviteToPortal && !profile.auth_user_id) {
    const invite = await inviteOrLinkAuthUser(supabase, {
      email,
      firstName: profile.first_name ?? lead.first_name,
      lastName: profile.last_name ?? lead.last_name,
      profileId: profile.id,
      failHard: false,
    });
    authUserId = invite.authUserId ?? authUserId;
    created.authInvite = invite.invited;
    if (invite.warning) warning = invite.warning;
    if (invite.authUserId) {
      profile = { ...profile, auth_user_id: invite.authUserId };
    }
  } else if (profile.auth_user_id) {
    authUserId = profile.auth_user_id;
  }

  if (!client) {
    const { data: createdClient, error: clientError } = await supabase
      .from("clients")
      .insert({ profile_id: profile.id, lead_id: input.leadId })
      .select("id,profile_id,lead_id,active_project_id")
      .single();

    if (clientError || !createdClient) {
      if (created.profile) {
        await supabase.from("profiles").delete().eq("id", profile.id);
      }
      if (created.authInvite && authUserId) {
        await supabase.auth.admin.deleteUser(authUserId);
      }
      return { success: false, status: 400, message: clientError?.message ?? "Unable to create client record." };
    }

    client = createdClient;
    created.client = true;
  } else if (!client.lead_id) {
    await supabase.from("clients").update({ lead_id: input.leadId }).eq("id", client.id);
    client = { ...client, lead_id: input.leadId };
  }

  let { data: project } = await supabase.from("projects").select("id,client_id").eq("lead_id", input.leadId).maybeSingle();

  if (!project) {
    const eventName =
      [lead.first_name, lead.last_name, lead.event_type].filter(Boolean).join(" ").trim() ||
      `${lead.event_type} for ${lead.first_name} ${lead.last_name}`;

    const { data: createdProject, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: client.id,
        lead_id: input.leadId,
        event_name: eventName,
        event_type: lead.event_type,
        event_date: lead.event_date,
        venue_name: lead.venue,
        city: lead.city,
        guest_count: lead.guest_count,
        budget: lead.estimated_budget,
        color_palette: lead.event_colors,
        theme: lead.event_theme,
        status: "planning",
        assigned_admin_id: lead.assigned_admin_id ?? input.actorId ?? null,
      })
      .select("id,client_id")
      .single();

    if (projectError || !createdProject) {
      if (created.client) await supabase.from("clients").delete().eq("id", client.id);
      if (created.profile) await supabase.from("profiles").delete().eq("id", profile.id);
      if (created.authInvite && authUserId) await supabase.auth.admin.deleteUser(authUserId);
      return { success: false, status: 400, message: projectError?.message ?? "Unable to create project." };
    }

    project = createdProject;
    created.project = true;
  } else {
    idempotent = true;
  }

  let { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", project.id)
    .maybeSingle();

  if (!conversation) {
    const { data: createdConversation, error: conversationError } = await supabase
      .from("conversations")
      .insert({ project_id: project.id, client_id: client.id })
      .select("id")
      .single();

    if (conversationError || !createdConversation) {
      if (created.project) await supabase.from("projects").delete().eq("id", project.id);
      if (created.client) await supabase.from("clients").delete().eq("id", client.id);
      if (created.profile) await supabase.from("profiles").delete().eq("id", profile.id);
      if (created.authInvite && authUserId) await supabase.auth.admin.deleteUser(authUserId);
      return {
        success: false,
        status: 400,
        message: conversationError?.message ?? "Unable to set up client messaging.",
      };
    }

    conversation = createdConversation;
    created.conversation = true;
  } else {
    idempotent = true;
  }

  await supabase.from("consultations").update({ project_id: project.id }).eq("lead_id", input.leadId);
  await supabase.from("leads").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", input.leadId);
  await supabase.from("clients").update({ active_project_id: project.id }).eq("id", client.id);

  if (created.profile || created.client || created.project) {
    await supabase.from("notifications").insert({
      recipient_id: profile.id,
      project_id: project.id,
      lead_id: input.leadId,
      type: "portal_created",
      title: "Your project workspace is ready",
      message: "Bridget Pope Designs has started your project workspace.",
      action_url: "/client/dashboard",
    });
  }

  await supabase.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    lead_id: input.leadId,
    project_id: project.id,
    action: "lead_converted",
    entity_type: "project",
    entity_id: project.id,
  });

  return {
    success: true,
    profileId: profile.id,
    clientId: client.id,
    projectId: project.id,
    conversationId: conversation.id,
    authUserId,
    idempotent: idempotent && !created.profile && !created.client && !created.project && !created.conversation,
    created,
    email,
    warning,
  };
}

export async function provisionManualClientAccount(
  supabase: SupabaseAdminLike,
  input: ClientAccountInput & { adminProfileId: string },
): Promise<ProvisionClientAccountResult> {
  const parsed = clientAccountSchema.parse(input);
  const email = parsed.email.trim().toLowerCase();
  const username = deriveUsername(email, parsed.username);
  const created: ProvisionCreatedFlags = {
    profile: false,
    client: false,
    project: false,
    conversation: false,
    authInvite: false,
  };

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

  const invite = await inviteOrLinkAuthUser(supabase, {
    email,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    username,
    failHard: true,
  });

  if (invite.error || !invite.authUserId) {
    return { success: false, status: 400, message: invite.error ?? "Unable to invite the client. Please try again." };
  }

  const authUserId = invite.authUserId;
  created.authInvite = invite.invited;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: authUserId,
      username,
      role: "client",
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      email,
      phone: parsed.phone || null,
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
  created.profile = true;

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
  created.client = true;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_id: client.id,
      event_name: parsed.eventName,
      event_type: parsed.eventType,
      event_date: parsed.eventDate || null,
      venue_name: parsed.venue || null,
      status: parsed.status,
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
  created.project = true;

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
  created.conversation = true;

  await supabase.from("clients").update({ active_project_id: project.id }).eq("id", client.id);

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
    warning: notificationError
      ? "The client account was created, but the welcome notification could not be delivered."
      : undefined,
  };
}

export async function provisionClient(
  supabase: SupabaseAdminLike,
  source: { type: "lead" } & LeadProvisionInput | { type: "manual"; input: ClientAccountInput & { adminProfileId: string } },
): Promise<ProvisionClientResult | ProvisionClientAccountResult> {
  if (source.type === "lead") {
    return provisionClientFromLead(supabase, source);
  }
  return provisionManualClientAccount(supabase, source.input);
}
