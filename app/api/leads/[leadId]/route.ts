import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteLeadWithConfirm } from "@/lib/admin/delete-records";
import { requireAdminProfile } from "@/lib/auth/require-admin";
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

const leadDeleteSchema = z.object({
  confirm: z.string().min(1).max(200),
});

export async function GET(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { leadId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("leads").select("*, bpd_files(*)").eq("id", leadId).single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
  return NextResponse.json({ success: true, lead: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { leadId } = await params;
  const input = leadUpdateSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("leads").update(input).eq("id", leadId).select().single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, lead: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { leadId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = leadDeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Provide { "confirm": "<lead name or DELETE>" } in the request body.' },
      { status: 400 },
    );
  }

  const result = await deleteLeadWithConfirm(createAdminClient(), leadId, parsed.data.confirm, admin.profile.id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message, dependents: result.dependents },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, message: result.message });
}
