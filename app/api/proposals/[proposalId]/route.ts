import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  return NextResponse.json({ proposal: { id: proposalId, status: "sent" } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const body = await request.json().catch(() => ({}));
  return NextResponse.json({ proposal: { id: proposalId, ...body } });
}
