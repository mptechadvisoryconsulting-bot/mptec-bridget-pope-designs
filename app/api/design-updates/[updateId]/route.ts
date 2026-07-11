import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const designUpdatePatchSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(["draft", "shared", "awaiting_feedback", "approved", "revision_requested"]).optional(),
  client_visible: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ updateId: string }> }) {
  const { updateId } = await params;
  const input = designUpdatePatchSchema.parse(await request.json());
  const { data, error } = await createAdminClient().from("design_updates").update(input).eq("id", updateId).select().single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, designUpdate: data });
}
