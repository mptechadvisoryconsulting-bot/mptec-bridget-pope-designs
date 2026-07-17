import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const designUpdateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(5000),
  status: z.enum(["draft", "shared", "awaiting_feedback", "approved", "revision_requested"]).default("draft"),
  clientVisible: z.boolean().default(false),
  requiresClientAction: z.boolean().default(false),
  clientActionType: z
    .enum(["design_approval", "design_feedback", "information_requested", "file_requested", "general"])
    .default("design_feedback"),
});

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const parsed = designUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid design update." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const { data, error } = await createAdminClient()
    .from("design_updates")
    .insert({
      project_id: input.projectId,
      title: input.title,
      description: input.description,
      status: input.status,
      client_visible: input.clientVisible,
      requires_client_action: input.requiresClientAction,
      client_action_type: input.requiresClientAction ? input.clientActionType : "not_required",
      client_action_status: input.requiresClientAction ? "pending" : "not_required",
      created_by: admin.profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, designUpdate: data }, { status: 201 });
}
