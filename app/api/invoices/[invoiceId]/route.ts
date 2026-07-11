import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { data, error } = await createAdminClient()
    .from("invoices")
    .select("*, bpd_invoice_items(*)")
    .eq("id", invoiceId)
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 404 });
  return NextResponse.json({ success: true, invoice: data });
}
