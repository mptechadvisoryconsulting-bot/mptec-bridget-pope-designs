import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

function storageBucketForFile(file: { visibility?: string | null; category?: string | null; storage_path?: string | null }) {
  const path = String(file.storage_path ?? "");
  const category = String(file.category ?? "");

  if (category.startsWith("invoice_template") || path.startsWith("logo/") || path.startsWith("background/")) {
    return "invoice-template-assets";
  }
  if (path.startsWith("gallery/") || file.visibility === "public_gallery") {
    return process.env.NEXT_PUBLIC_GALLERY_BUCKET ?? "event-gallery";
  }
  if (category === "inquiry_pdf" || path.startsWith("inquiry/")) {
    return "inquiry-pdfs";
  }
  return "project-files";
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { fileId } = await params;
  const supabase = createAdminClient();
  const { data: file, error: lookupError } = await supabase
    .from("files")
    .select("id,storage_path,visibility,category")
    .eq("id", fileId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ success: false, message: lookupError.message }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ success: false, message: "File not found." }, { status: 404 });
  }

  const storagePath = String(file.storage_path ?? "").trim();
  if (storagePath && !storagePath.startsWith("http") && !storagePath.startsWith("/")) {
    const bucket = storageBucketForFile(file);
    const { error: storageError } = await supabase.storage.from(bucket).remove([storagePath]);
    if (storageError) {
      console.error("file_storage_delete_failed", { fileId, bucket, message: storageError.message });
    }
  }

  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });

  if (file.visibility === "public_gallery") {
    revalidatePath("/");
    revalidatePath("/gallery");
    revalidatePath("/admin/gallery");
  }

  return NextResponse.json({ success: true });
}
