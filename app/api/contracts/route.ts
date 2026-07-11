import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ contract: { id: "contract-1001", status: "ready", ...body } }, { status: 201 });
}
