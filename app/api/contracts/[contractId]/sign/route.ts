import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const signatureSchema = z.object({
  signer: z.enum(["client", "owner"]),
  signature: z.string().min(2).max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const input = signatureSchema.parse(await request.json());
  const fields =
    input.signer === "client"
      ? { client_signature: input.signature, client_signed_at: new Date().toISOString() }
      : { owner_signature: input.signature, owner_signed_at: new Date().toISOString() };
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("contracts").update(fields).eq("id", contractId).select().single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, contract: data });
}
