import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { getInquiryContent, saveInquiryContent } from "@/lib/website/inquiry-content";

export async function GET() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;
  return NextResponse.json({ success: true, content: await getInquiryContent() });
}

export async function PUT(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("content" in body)) {
    return NextResponse.json({ success: false, message: "Invalid questionnaire content." }, { status: 400 });
  }

  try {
    const saved = await saveInquiryContent((body as { content: unknown }).content, admin.profile.id);
    revalidatePath("/inquire");
    revalidatePath("/admin/inquiry");
    return NextResponse.json({ success: true, content: saved.content });
  } catch (error) {
    console.error("inquiry_config_save_failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, message: "Unable to save inquiry questions." }, { status: 400 });
  }
}
