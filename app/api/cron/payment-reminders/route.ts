import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    disabled: true,
    message: "Payment reminders are handled in HoneyBook. This cron route is intentionally inactive.",
  });
}
