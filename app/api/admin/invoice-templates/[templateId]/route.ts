import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  await params;
  await request.text();
  return NextResponse.json(
    { success: false, message: "Custom invoice templates are disabled. Use HoneyBook for invoice documents." },
    { status: 410 },
  );
}
