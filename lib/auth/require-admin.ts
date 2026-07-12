import { NextResponse } from "next/server";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";

export async function requireAdminProfile() {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }

  if (!profile?.active || !adminRoles.has(profile.role)) {
    return { error: NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 }) };
  }

  return { profile };
}
