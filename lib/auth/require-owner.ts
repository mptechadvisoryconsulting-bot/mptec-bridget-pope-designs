import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-profile";

export async function requireOwnerProfile() {
  const { profile } = await getCurrentProfile();

  if (!profile) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 }) };
  }

  if (!profile.active || profile.role !== "owner") {
    return { error: NextResponse.json({ success: false, message: "Owner access required" }, { status: 403 }) };
  }

  return { profile };
}
