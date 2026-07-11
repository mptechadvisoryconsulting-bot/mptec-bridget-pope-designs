import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const leadUpdateSchema = z.object({
  status: z.enum([
    "new",
    "contacted",
    "consultation_scheduled",
    "consultation_completed",
    "proposal_preparing",
    "proposal_sent",
    "awaiting_approval",
    "awaiting_contract",
    "awaiting_deposit",
    "converted",
    "lost",
    "archived",
  ]).optional(),
  consultation_notes: z.string().max(5000).optional(),
  assigned_admin_id: z.string().uuid().nullable().optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("leads").select("*, files(*)").eq("id", leadId).single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
  return NextResponse.json({ success: true, lead: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const input = leadUpdateSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("leads").update(input).eq("id", leadId).select().single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, lead: data });
}
