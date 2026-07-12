import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const proposalCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2).max(200).optional(),
  introduction: z.string().max(2000).optional(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { data, error } = await createAdminClient()
    .from("proposals")
    .select("id,proposal_number,title,total,deposit_amount,status,expiration_date,project_id,created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, proposals: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = proposalCreateSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", input.projectId).maybeSingle();

  if (!project) {
    return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("proposals")
    .insert({
      project_id: input.projectId,
      title: input.title ?? "Event Design Proposal",
      introduction: input.introduction ?? null,
      expiration_date: input.expirationDate ?? null,
      status: "draft",
      created_by: admin.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, proposal: data }, { status: 201 });
}
