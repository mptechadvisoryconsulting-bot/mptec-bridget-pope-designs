import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    { success: false, message: "Custom proposals are disabled. Create and manage proposals in HoneyBook." },
    { status: 410 },
  );
}

export const GET = disabled;
export const PATCH = disabled;
