import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Invoice sending is handled in HoneyBook. Link the HoneyBook reference on the project page." },
    { status: 410 },
  );
}
