import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteProjectWithConfirm, getProjectDeleteSummary } from "@/lib/admin/delete-records";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const deleteSchema = z.object({
  confirm: z.string().min(1).max(200),
});

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { projectId } = await params;
  const summary = await getProjectDeleteSummary(createAdminClient(), projectId);
  if (!summary) {
    return NextResponse.json({ success: false, message: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, summary });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { projectId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Provide { "confirm": "<event name or DELETE>" } in the request body.' },
      { status: 400 },
    );
  }

  const result = await deleteProjectWithConfirm(createAdminClient(), projectId, parsed.data.confirm, admin.profile.id);
  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message, dependents: result.dependents },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, message: result.message });
}
