import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Contract signatures are handled in HoneyBook." },
    { status: 410 },
  );
}
