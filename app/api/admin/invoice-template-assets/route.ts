import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await request.text();
  return NextResponse.json(
    { success: false, message: "Custom invoice template assets are disabled. Use HoneyBook for invoice documents." },
    { status: 410 },
  );
}
