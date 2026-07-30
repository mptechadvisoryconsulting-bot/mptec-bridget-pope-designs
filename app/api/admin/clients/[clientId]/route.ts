import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteClientWithConfirm, getClientDeleteSummary } from "@/lib/admin/delete-records";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const deleteSchema = z.object({
  confirm: z.string().min(1).max(200),
  cascade: z.boolean().optional().default(false),
});

export async function GET(_request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { clientId } = await params;
  const summary = await getClientDeleteSummary(createAdminClient(), clientId);
  if (!summary) {
    return NextResponse.json({ success: false, message: "Client not found." }, { status: 404 });
  }

  return NextResponse.json({ success: true, summary });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { clientId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: 'Provide { "confirm": "<client name or DELETE>", "cascade": true } when related projects exist.',
      },
      { status: 400 },
    );
  }

  const result = await deleteClientWithConfirm(createAdminClient(), clientId, {
    confirm: parsed.data.confirm,
    cascade: parsed.data.cascade,
    actorId: admin.profile.id,
  });

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.message, dependents: result.dependents },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, message: result.message });
}
