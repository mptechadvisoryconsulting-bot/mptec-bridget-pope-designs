import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { consultationSchema } from "@/lib/validation/consultation-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = consultationSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("consultations")
    .insert({
      lead_id: input.leadId,
      project_id: input.projectId,
      scheduled_at: input.scheduledAt,
      timezone: "America/Chicago",
      meeting_type: input.meetingType,
      meeting_link: input.meetingLink || null,
      location: input.location || null,
      status: "scheduled",
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (input.leadId) await supabase.from("leads").update({ status: "consultation_scheduled" }).eq("id", input.leadId);
  return NextResponse.json({ success: true, consultation: data }, { status: 201 });
}
