import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { fileId } = await params;
  const { error } = await createAdminClient().from("files").delete().eq("id", fileId);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
