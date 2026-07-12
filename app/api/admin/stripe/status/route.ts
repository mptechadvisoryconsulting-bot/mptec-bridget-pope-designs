import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeReadiness } from "@/lib/stripe/connect";

export async function GET() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const readiness = await getStripeReadiness(createAdminClient());
  return NextResponse.json({ success: true, ...readiness });
}
