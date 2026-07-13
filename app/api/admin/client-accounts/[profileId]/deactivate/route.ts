import { NextResponse } from "next/server";
import { deactivateClientAccount } from "@/lib/admin/client-account-actions";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { profileId } = await params;
  const result = await deactivateClientAccount(createAdminClient(), profileId);

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true, message: result.message });
}
