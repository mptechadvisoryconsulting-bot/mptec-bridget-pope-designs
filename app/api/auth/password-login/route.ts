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

export async function POST(request: Request) {
  const input = loginSchema.parse(await request.json());
  const supabase = await getSupabaseServerClient();
  const email = credentialToEmail(input.credential);
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
