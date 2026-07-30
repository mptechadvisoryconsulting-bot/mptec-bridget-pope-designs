import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { hasSupabaseAdminEnv, safeErrorMessage } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 15 * 1024 * 1024;

function cleanFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function POST(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const admin = await requireAdminProfile();
    if (admin.error) return admin.error;

    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json({ success: false, message: "Supabase environment variables are required for uploads." }, { status: 503 });
    }

    const { fileId } = await params;
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "An image file is required." }, { status: 400 });
    }
    if (!imageTypes.has(file.type)) {
      return NextResponse.json({ success: false, message: "Upload a JPG, PNG, or WebP image." }, { status: 400 });
    }
    if (file.size > maxImageSize) {
      return NextResponse.json({ success: false, message: "Image must be 15 MB or smaller." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: existing, error: lookupError } = await supabase
      .from("files")
      .select("id,storage_path,title,file_name,visibility")
      .eq("id", fileId)
      .eq("visibility", "public_gallery")
      .maybeSingle();

    if (lookupError) return NextResponse.json({ success: false, message: lookupError.message }, { status: 400 });
    if (!existing) return NextResponse.json({ success: false, message: "Gallery item not found." }, { status: 404 });

    const bucket = process.env.NEXT_PUBLIC_GALLERY_BUCKET ?? "event-gallery";
    const title = existing.title || existing.file_name || "event-photo";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? file.type.split("/")[1] ?? "jpg";
    const storagePath = `gallery/${cleanFilePart(title) || "event-photo"}-${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ success: false, message: uploadError.message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("files")
      .update({
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId)
      .select()
      .single();

    if (error) {
      await supabase.storage.from(bucket).remove([storagePath]);
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    const oldPath = String(existing.storage_path ?? "");
    if (oldPath && !oldPath.startsWith("http") && !oldPath.startsWith("/") && oldPath !== storagePath) {
      const { count } = await supabase
        .from("files")
        .select("id", { count: "exact", head: true })
        .eq("storage_path", oldPath);
      if ((count ?? 0) === 0) {
        await supabase.storage.from(bucket).remove([oldPath]);
      }
    }

    revalidatePath("/");
    revalidatePath("/gallery");
    revalidatePath("/admin/gallery");

    return NextResponse.json({ success: true, file: data });
  } catch (error) {
    return NextResponse.json({ success: false, message: safeErrorMessage(error) }, { status: 400 });
  }
}
