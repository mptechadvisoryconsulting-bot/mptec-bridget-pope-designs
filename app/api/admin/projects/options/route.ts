import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { data, error } = await createAdminClient()
    .from("projects")
    .select("id,event_name,client_id,status")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, projects: data ?? [] });
}
