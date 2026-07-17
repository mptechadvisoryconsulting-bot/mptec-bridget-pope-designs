import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const contractCreateSchema = z.object({
  projectId: z.string().uuid(),
  proposalId: z.string().uuid().optional(),
  content: z.string().max(10000).optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = contractCreateSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data: project } = await supabase.from("projects").select("id").eq("id", input.projectId).maybeSingle();

  if (!project) {
    return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
  }

  if (input.proposalId) {
    const { data: proposal } = await supabase
      .from("proposals")
      .select("id")
      .eq("id", input.proposalId)
      .eq("project_id", input.projectId)
      .maybeSingle();

    if (!proposal) {
      return NextResponse.json({ success: false, message: "Proposal does not belong to this project." }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      project_id: input.projectId,
      proposal_id: input.proposalId ?? null,
      content: input.content ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, contract: data }, { status: 201 });
}
