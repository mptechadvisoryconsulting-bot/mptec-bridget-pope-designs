import { clientAuthRedirectUrl } from "@/lib/auth/client-invite";

export type SupabaseAdminActionsClient = {
  from(table: string): any;
  auth: {
    admin: {
      inviteUserByEmail: (email: string, options?: { data?: object; redirectTo?: string }) => Promise<{ data: any; error: any }>;
      updateUserById: (id: string, attributes: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    };
    resetPasswordForEmail: (email: string, options?: { redirectTo?: string }) => Promise<{ data: any; error: any }>;
  };
};

export type ClientAccountActionResult = { success: true; message: string } | { success: false; status: number; message: string };

type ClientProfileRow = {
  id: string;
  email: string;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  active: boolean;
  auth_user_id?: string | null;
};

async function loadClientProfile(supabase: SupabaseAdminActionsClient, profileId: string): Promise<ClientProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id,email,username,first_name,last_name,role,active,auth_user_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!data || data.role !== "client") return null;
  return data as ClientProfileRow;
}

export async function resendClientInvitation(supabase: SupabaseAdminActionsClient, profileId: string): Promise<ClientAccountActionResult> {
  const profile = await loadClientProfile(supabase, profileId);
  if (!profile) {
    return { success: false, status: 404, message: "That client could not be found." };
  }

  if (!profile.active) {
    return { success: false, status: 409, message: "Reactivate this client before resending an invitation." };
  }

  const { error } = await supabase.auth.admin.inviteUserByEmail(profile.email, {
    data: {
      username: profile.username,
      first_name: profile.first_name,
      last_name: profile.last_name,
      role: "client",
    },
    redirectTo: clientAuthRedirectUrl(),
  });

  if (error) {
    const alreadyRegistered = /registered|exists/i.test(error.message ?? "");
    return {
      success: false,
      status: alreadyRegistered ? 409 : 400,
      message: alreadyRegistered
        ? "This client already accepted their invitation. Use Send Password Reset instead."
        : error.message ?? "Unable to resend the invitation.",
    };
  }

  return { success: true, message: `Invitation resent to ${profile.email}.` };
}

export async function deactivateClientAccount(supabase: SupabaseAdminActionsClient, profileId: string): Promise<ClientAccountActionResult> {
  const profile = await loadClientProfile(supabase, profileId);
  if (!profile) {
    return { success: false, status: 404, message: "That client could not be found." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", profileId);

  if (error) {
    return { success: false, status: 400, message: error.message ?? "Unable to deactivate this client." };
  }

  if (profile.auth_user_id) {
    const { error: banError } = await supabase.auth.admin.updateUserById(profile.auth_user_id, { ban_duration: "876000h" });
    if (banError) {
      console.error("client_account_deactivate_ban_failed", { profileId, code: banError?.code });
    }
  }

  return { success: true, message: "Client portal access deactivated." };
}

export async function triggerClientPasswordReset(supabase: SupabaseAdminActionsClient, profileId: string): Promise<ClientAccountActionResult> {
  const profile = await loadClientProfile(supabase, profileId);
  if (!profile) {
    return { success: false, status: 404, message: "That client could not be found." };
  }

  if (!profile.active) {
    return { success: false, status: 409, message: "Reactivate this client before sending a password reset." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: clientAuthRedirectUrl(),
  });

  if (error) {
    return { success: false, status: 400, message: error.message ?? "Unable to send the password reset email." };
  }

  return { success: true, message: `Password reset email sent to ${profile.email}.` };
}
