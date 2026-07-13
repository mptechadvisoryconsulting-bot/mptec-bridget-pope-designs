import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { hasSupabaseAdminEnv, safeErrorMessage } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSize = 15 * 1024 * 1024;
const assetTypes = new Set(["logo", "background"]);

export async function POST(request: Request) {
  try {
    const admin = await requireAdminProfile();
    if (admin.error) return admin.error;

    if (!hasSupabaseAdminEnv()) {
      return NextResponse.json(
        { success: false, message: "Supabase environment variables are required for uploads." },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    const assetType = String(form.get("assetType") ?? "logo");
    const templateId = form.get("templateId");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "An image file is required." }, { status: 400 });
    }

    if (!assetTypes.has(assetType)) {
      return NextResponse.json({ success: false, message: "Unsupported asset type." }, { status: 400 });
    }

    if (!imageTypes.has(file.type)) {
      return NextResponse.json({ success: false, message: "Upload a JPG, PNG, or WebP image." }, { status: 400 });
    }

    if (file.size > maxImageSize) {
      return NextResponse.json({ success: false, message: "Image must be 15 MB or smaller." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const bucket = "invoice-template-assets";
    const extension = file.name.split(".").pop()?.toLowerCase() ?? file.type.split("/")[1] ?? "png";
    const storagePath = `${assetType}/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(storagePath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ success: false, message: uploadError.message }, { status: 400 });
    }

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .insert({
        uploaded_by: admin.profile.id,
        category: `invoice_template_${assetType}`,
        file_name: file.name,
        storage_path: storagePath,
        mime_type: file.type,
        file_size: file.size,
        visibility: "public_gallery",
      })
      .select("id")
      .single();

    if (fileError) {
      return NextResponse.json({ success: false, message: fileError.message }, { status: 400 });
    }

    if (typeof templateId === "string" && templateId) {
      await supabase.from("invoice_template_assets").insert({
        template_id: templateId,
        file_id: fileRow?.id ?? null,
        asset_type: assetType,
      });
    }

    const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(storagePath);

    return NextResponse.json({ success: true, url: publicUrl.publicUrl, fileId: fileRow?.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, message: safeErrorMessage(error) }, { status: 400 });
  }
}
