import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import {
  getWebsiteContent,
  normalizeFixedServices,
  upsertWebsiteSection,
  type WebsiteSectionKey,
} from "@/lib/website/content";

const sectionKeys = [
  "hero",
  "services",
  "homepage_gallery",
  "featured_designs",
  "about",
  "faq",
  "contact",
  "testimonials",
  "footer",
  "social",
] as const satisfies WebsiteSectionKey[];

const putSchema = z.object({
  sectionKey: z.enum(sectionKeys),
  content: z.record(z.any()),
});

export async function GET() {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const content = await getWebsiteContent();
  return NextResponse.json({ success: true, content });
}

export async function PUT(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid website content." }, { status: 400 });
  }

  let content = parsed.data.content;
  if (parsed.data.sectionKey === "services") {
    const items = normalizeFixedServices((content.items as never) ?? []);
    content = { ...content, items };
  }

  try {
    const saved = await upsertWebsiteSection(parsed.data.sectionKey, content, admin.profile.id);
    revalidatePath("/");
    revalidatePath("/services");
    revalidatePath("/about");
    revalidatePath("/faq");
    revalidatePath("/reviews");
    revalidatePath("/gallery");
    revalidatePath("/contact");
    revalidatePath("/admin/website");
    return NextResponse.json({ success: true, section: saved });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to save website content." },
      { status: 400 },
    );
  }
}
