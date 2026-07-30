import { randomBytes } from "crypto";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-calculations";
import { resolveInvoiceTemplate } from "@/lib/invoices/templates";

type AdminLike = {
  from: (table: string) => any;
};

function invoiceNumber() {
  return `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export type CreateInvoiceFromProposalResult =
  | { success: true; invoiceId: string; invoiceNumber: string; created: boolean }
  | { success: false; message: string };

/**
 * Creates a draft invoice from an approved proposal's line items when one does not already exist.
 * Idempotent: if a draft/open invoice already references the proposal, returns that invoice.
 */
export async function createDraftInvoiceFromProposal(
  supabase: AdminLike,
  input: { proposalId: string; projectId: string; clientId: string; actorId?: string | null },
): Promise<CreateInvoiceFromProposalResult> {
  const { data: existing } = await supabase
    .from("invoices")
    .select("id,invoice_number,status")
    .eq("proposal_id", input.proposalId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return {
      success: true,
      invoiceId: existing.id,
      invoiceNumber: existing.invoice_number,
      created: false,
    };
  }

  const { data: proposal, error: proposalError } = await supabase
    .from("proposals")
    .select("id,project_id,title,tax_amount,discount_amount,bpd_proposal_items(title,description,quantity,unit_price,total,sort_order)")
    .eq("id", input.proposalId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (proposalError || !proposal) {
    return { success: false, message: proposalError?.message ?? "Proposal not found for invoice creation." };
  }

  const rawItems = (proposal.bpd_proposal_items ?? []) as Array<{
    title?: string | null;
    description?: string | null;
    quantity?: number | null;
    unit_price?: number | null;
    total?: number | null;
    sort_order?: number | null;
  }>;

  type LineInput = { title: string; description?: string; quantity: number; unitPrice: number };

  const lineInputs: LineInput[] =
    rawItems.length > 0
      ? rawItems
          .slice()
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item) => ({
            title: item.title?.trim() || "Line item",
            description: item.description ?? undefined,
            quantity: Number(item.quantity ?? 1) || 1,
            unitPrice: Number(item.unit_price ?? 0) || 0,
          }))
      : [{ title: proposal.title?.trim() || "Event services", quantity: 1, unitPrice: 0 }];

  const totals = calculateInvoiceTotals(lineInputs, Number(proposal.tax_amount ?? 0), Number(proposal.discount_amount ?? 0));
  const { template, snapshot } = await resolveInvoiceTemplate(supabase as never, undefined, undefined);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      project_id: input.projectId,
      client_id: input.clientId,
      proposal_id: input.proposalId,
      invoice_number: invoiceNumber(),
      invoice_type: "standard",
      description: proposal.title ? `Invoice for ${proposal.title}` : "Invoice from approved proposal",
      subtotal: totals.subtotal,
      tax_amount: totals.taxAmount,
      discount_amount: totals.discountAmount,
      total: totals.total,
      amount_paid: 0,
      balance_due: totals.total,
      status: "draft",
      template_id: template.id,
      template_snapshot: snapshot,
      template_overrides: null,
      active_version: 1,
    })
    .select("id,invoice_number")
    .single();

  if (error || !invoice) {
    return { success: false, message: error?.message ?? "Unable to create draft invoice." };
  }

  const { error: itemError } = await supabase.from("invoice_items").insert(
    totals.items.map((item) => ({
      invoice_id: invoice.id,
      title: item.title,
      description: item.description ?? null,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    })),
  );

  if (itemError) {
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { success: false, message: itemError.message ?? "Unable to create invoice line items." };
  }

  const { error: versionError } = await supabase.from("invoice_versions").insert({
    invoice_id: invoice.id,
    version_number: 1,
    template_id: template.id,
    template_snapshot: snapshot,
    invoice_snapshot: {
      invoice,
      items: totals.items,
      totals: {
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        total: totals.total,
      },
      source: "proposal_approved",
      proposalId: input.proposalId,
    },
    status: "active",
    created_by: input.actorId ?? null,
  });

  if (versionError) {
    await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { success: false, message: versionError.message ?? "Unable to create invoice version." };
  }

  return {
    success: true,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    created: true,
  };
}
