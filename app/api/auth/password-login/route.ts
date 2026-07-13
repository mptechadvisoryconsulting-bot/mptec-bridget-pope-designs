import { NextResponse } from "next/server";
import { z } from "zod";
import { credentialToEmail } from "@/lib/auth/portal-credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  credential: z.string().min(2).max(160),
  password: z.string().min(1).max(200),
});

const adminRoles = new Set(["owner", "admin"]);

async function resolveLoginEmail(credential: string) {
  const value = credential.trim();
  if (value.includes("@")) return value.toLowerCase();

  const username = value.toLowerCase();
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("username", username)
    .maybeSingle();

  // Prefer the real client email stored on the profile (invite-based accounts).
  if (profile?.email && String(profile.email).includes("@")) {
    return String(profile.email).toLowerCase();
  }

  return credentialToEmail(value);
}

export async function POST(request: Request) {
  const input = loginSchema.parse(await request.json());
  const supabase = await getSupabaseServerClient();
  const email = await resolveLoginEmail(input.credential);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });

  if (error || !data.user) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to sign in." }, { status: 401 });
  }

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role,active")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();

  if (!profile?.active) {
    await supabase.auth.signOut();
    return NextResponse.json({ success: false, message: "This login does not have an active portal profile." }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    role: profile.role,
    redirectTo: adminRoles.has(profile.role) ? "/admin" : "/client/dashboard",
  });
}
