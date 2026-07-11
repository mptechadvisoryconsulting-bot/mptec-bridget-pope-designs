import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ uploadUrl: "/documents/demo-upload", storage: "supabase-storage-stub" });
}
