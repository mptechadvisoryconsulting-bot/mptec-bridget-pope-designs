import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const adminRoles = new Set(["owner", "admin"]);

export async function requireAdminProfile() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("id, role, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.active || !adminRoles.has(profile.role)) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) };
  }

  return { profile };
}
