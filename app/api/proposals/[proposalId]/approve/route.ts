import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { success: false, message: "Proposal approvals are handled in HoneyBook." },
    { status: 410 },
  );
}
