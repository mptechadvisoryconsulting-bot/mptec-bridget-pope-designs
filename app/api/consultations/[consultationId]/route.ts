import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { consultationUpdateSchema } from "@/lib/validation/consultation-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ consultationId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { consultationId } = await params;
  const input = consultationUpdateSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("consultations").update(input).eq("id", consultationId).select().single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, consultation: data });
}
