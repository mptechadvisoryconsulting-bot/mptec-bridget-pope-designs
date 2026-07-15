import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { success: false, message: "Invoice PDFs are generated in HoneyBook. This app stores reference data only." },
    { status: 410 },
  );
}
