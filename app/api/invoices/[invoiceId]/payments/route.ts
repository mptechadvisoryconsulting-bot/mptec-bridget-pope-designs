import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Payment recording is handled in HoneyBook. This app stores reference data only." },
    { status: 410 },
  );
}
