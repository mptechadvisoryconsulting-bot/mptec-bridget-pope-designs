import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const proposalItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  category: z.string().trim().max(80).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const proposalPatchSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  introduction: z.string().trim().max(2000).optional().nullable(),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  discountAmount: z.coerce.number().min(0).optional(),
  taxAmount: z.coerce.number().min(0).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  status: z.enum(["draft", "sent", "viewed", "approved", "rejected", "expired"]).optional(),
  items: z.array(proposalItemSchema).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { proposalId } = await params;
  const { data, error } = await createAdminClient()
    .from("proposals")
    .select("*, bpd_proposal_items(*)")
    .eq("id", proposalId)
    .maybeSingle();

  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  return NextResponse.json({ success: true, proposal: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { proposalId } = await params;
  const parsed = proposalPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid proposal update." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const input = parsed.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.introduction !== undefined) patch.introduction = input.introduction;
  if (input.expirationDate !== undefined) patch.expiration_date = input.expirationDate;
  if (input.discountAmount !== undefined) patch.discount_amount = input.discountAmount;
  if (input.taxAmount !== undefined) patch.tax_amount = input.taxAmount;
  if (input.depositAmount !== undefined) patch.deposit_amount = input.depositAmount;
  if (input.status !== undefined) patch.status = input.status;

  if (input.items) {
    await supabase.from("proposal_items").delete().eq("proposal_id", proposalId);

    const rows = input.items.map((item, index) => {
      const quantity = Number(item.quantity ?? 1);
      const unitPrice = Number(item.unitPrice ?? 0);
      return {
        proposal_id: proposalId,
        title: item.title,
        description: item.description ?? null,
        category: item.category ?? null,
        quantity,
        unit_price: unitPrice,
        total: quantity * unitPrice,
        sort_order: item.sortOrder ?? index,
      };
    });

    if (rows.length) {
      const { error: itemsError } = await supabase.from("proposal_items").insert(rows);
      if (itemsError) {
        return NextResponse.json({ success: false, message: itemsError.message }, { status: 400 });
      }
    }

    const subtotal = rows.reduce((sum, row) => sum + Number(row.total), 0);
    const discount = Number(input.discountAmount ?? 0);
    const tax = Number(input.taxAmount ?? 0);
    patch.subtotal = subtotal;
    patch.total = Math.max(0, subtotal - discount + tax);
  }

  const { data, error } = await supabase.from("proposals").update(patch).eq("id", proposalId).select("*").maybeSingle();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });

  return NextResponse.json({ success: true, proposal: data });
}
