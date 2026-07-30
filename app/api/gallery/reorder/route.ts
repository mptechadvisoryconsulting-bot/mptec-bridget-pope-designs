import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

export async function PUT(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Provide orderedIds to reorder the gallery." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const results = await Promise.all(
    parsed.data.orderedIds.map((id, index) =>
      supabase
        .from("files")
        .update({ sort_order: index, updated_at: now })
        .eq("id", id)
        .eq("visibility", "public_gallery"),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    return NextResponse.json({ success: false, message: failed.error.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/admin/gallery");

  return NextResponse.json({ success: true });
}
