import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  showOnHomepage: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

function revalidateGalleryPaths() {
  revalidatePath("/");
  revalidatePath("/gallery");
  revalidatePath("/admin/gallery");
  revalidatePath("/admin/website");
}

export async function PATCH(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { fileId } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid gallery update." }, { status: 400 });
  }

  const input = parsed.data;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) {
    patch.title = input.title;
    patch.file_name = input.title;
  }
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.showOnHomepage !== undefined) patch.show_on_homepage = input.showOnHomepage;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  if (input.isVisible !== undefined) patch.is_visible = input.isVisible;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("files")
    .update(patch)
    .eq("id", fileId)
    .eq("visibility", "public_gallery")
    .select("id,title,file_name,category,description,storage_path,created_at,sort_order,show_on_homepage,is_featured,is_visible")
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ success: false, message: "Gallery item not found." }, { status: 404 });

  revalidateGalleryPaths();
  return NextResponse.json({ success: true, item: data });
}
