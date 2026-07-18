import { NextResponse } from "next/server";
import { getPublicGalleryItems } from "@/lib/gallery";

export async function GET() {
  // Admin gallery manager refreshes through this route — never surface static fallbacks here.
  const items = await getPublicGalleryItems(48, { allowFallback: false });
  return NextResponse.json({ success: true, items });
}
