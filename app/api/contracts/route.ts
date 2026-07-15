import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    { success: false, message: "Custom contracts are disabled. Create and manage contracts in HoneyBook." },
    { status: 410 },
  );
}

export const GET = disabled;
export const POST = disabled;
