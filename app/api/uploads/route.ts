import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
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

export async function POST(request: Request) {
  try {
    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        { success: false, message: "Supabase environment variables are required for uploads." },
        { status: 503 },
      );
    }

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
    const bucket = process.env.NEXT_PUBLIC_GALLERY_BUCKET ?? "event-gallery";
    const category = String(form.get("category") ?? "Event Design").trim() || "Event Design";
    const title = String(form.get("title") ?? file.name).trim() || file.name;
    const uploadedBy = String(form.get("uploadedBy") ?? "").trim() || null;
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
      .insert({
        uploaded_by: uploadedBy,
        category,
        file_name: title,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        visibility: "public_gallery",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return NextResponse.json({ success: true, file: data, publicUrl: publicUrl.publicUrl }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: safeErrorMessage(error) }, { status: 400 });
  }
}
