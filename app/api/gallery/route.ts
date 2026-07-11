import { NextResponse } from "next/server";
import { getPublicGalleryItems } from "@/lib/gallery";

export async function GET() {
  const items = await getPublicGalleryItems();
  return NextResponse.json({ success: true, items });
}
