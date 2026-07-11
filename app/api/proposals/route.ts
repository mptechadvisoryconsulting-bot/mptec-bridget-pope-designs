import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ proposals: [{ id: "proposal-1001", status: "sent" }] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ proposal: { id: "proposal-1001", ...body } }, { status: 201 });
}
