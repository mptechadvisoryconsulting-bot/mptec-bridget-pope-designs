import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${requireEnv("CRON_SECRET")}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ job: "payment-reminders", status: "queued" });
}
