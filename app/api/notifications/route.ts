import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const recipientId = new URL(request.url).searchParams.get("recipientId");
  if (!recipientId) return NextResponse.json({ success: false, message: "recipientId is required" }, { status: 400 });
  const { data, error } = await createAdminClient()
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .is("read_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, notifications: data });
}
