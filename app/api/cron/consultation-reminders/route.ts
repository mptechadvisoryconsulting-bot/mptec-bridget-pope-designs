import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await createAdminClient().from("automation_logs").insert({
    automation_type: "consultation_reminders",
    status: "success",
    executed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
