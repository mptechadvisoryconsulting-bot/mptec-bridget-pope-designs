import { NextResponse } from "next/server";
import { getCurrentProfile, adminRoles } from "@/lib/auth/current-profile";
import { getPublicGalleryItems } from "@/lib/gallery";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const homepageOnly = searchParams.get("homepage") === "1";
  const featuredOnly = searchParams.get("featured") === "1";
  const wantAdmin = searchParams.get("admin") === "1";
  const limit = Math.min(Number(searchParams.get("limit") ?? 48) || 48, 200);

  let includeHidden = false;
  if (wantAdmin) {
    const { profile } = await getCurrentProfile();
    includeHidden = Boolean(profile?.active && adminRoles.has(profile.role));
  }

  const items = await getPublicGalleryItems({
    limit,
    homepageOnly,
    featuredOnly,
    includeHidden,
  });

  return NextResponse.json({ success: true, items });
}
