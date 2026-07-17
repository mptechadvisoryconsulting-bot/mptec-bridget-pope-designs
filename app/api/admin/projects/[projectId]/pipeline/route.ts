import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { runPipelineAction } from "@/lib/admin/pipeline";
import { createAdminClient } from "@/lib/supabase/admin";
import { pipelineActionSchema } from "@/lib/validation/honeybook-schema";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { projectId } = await params;
  const parsed = pipelineActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid pipeline action." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const result = await runPipelineAction(supabase, projectId, {
    action: parsed.data.action,
    actorId: admin.profile.id,
    honeybookUrl: parsed.data.honeybookUrl || null,
    proposalId: parsed.data.proposalId,
    invoiceId: parsed.data.invoiceId,
    note: parsed.data.note || null,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, message: result.message ?? "Pipeline action failed." }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    stage: result.stage,
    honeybookUrl: result.honeybookUrl,
    provisioned: result.provisioned,
    warning: result.warning,
    message: result.message,
  });
}
