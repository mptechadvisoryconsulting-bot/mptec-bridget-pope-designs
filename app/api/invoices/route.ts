import { NextResponse } from "next/server";

function disabled() {
  return NextResponse.json(
    { success: false, message: "Custom invoices are disabled. Use HoneyBook and link a project reference instead." },
    { status: 410 },
  );
}

export const GET = disabled;
export const POST = disabled;
