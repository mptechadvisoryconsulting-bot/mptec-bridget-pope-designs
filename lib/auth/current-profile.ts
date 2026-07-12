import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const adminRoles = new Set(["owner", "admin"]);

export type CurrentProfile = {
  id: string;
  role: string;
  active: boolean;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
};

export async function getCurrentProfile(): Promise<{ user: User | null; profile: CurrentProfile | null }> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id,role,active,first_name,last_name,email,phone,username")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return { user, profile: (profile as CurrentProfile | null) ?? null };
}

export function displayName(profile?: Pick<CurrentProfile, "first_name" | "last_name" | "email" | "username"> | null) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || profile?.username || "Client";
}
