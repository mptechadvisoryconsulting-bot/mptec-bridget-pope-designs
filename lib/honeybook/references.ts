import type { SupabaseClient } from "@supabase/supabase-js";

export const honeybookSources = ["manual", "pdf_import", "csv_import", "automation"] as const;
export const honeybookStatuses = ["draft", "sent", "viewed", "partially_paid", "paid", "overdue", "cancelled", "unknown"] as const;

export type HoneyBookSource = (typeof honeybookSources)[number];

export type HoneyBookReferenceInput = {
  projectId: string;
  clientId: string;
  honeybookProjectId?: string | null;
  honeybookInvoiceNumber?: string | null;
  invoiceTotal?: number | null;
  amountPaid?: number | null;
  balanceRemaining?: number | null;
  invoiceStatus?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  honeybookUrl?: string | null;
  source?: HoneyBookSource;
};

function cleanText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanMoney(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.max(0, Math.round(Number(value) * 100 + 1e-6) / 100);
}

export function toHoneyBookReferenceInsert(input: HoneyBookReferenceInput) {
  return {
    project_id: input.projectId,
    client_id: input.clientId,
    honeybook_project_id: cleanText(input.honeybookProjectId),
    honeybook_invoice_number: cleanText(input.honeybookInvoiceNumber),
    invoice_total: cleanMoney(input.invoiceTotal),
    amount_paid: cleanMoney(input.amountPaid),
    balance_remaining: cleanMoney(input.balanceRemaining),
    invoice_status: cleanText(input.invoiceStatus) ?? "unknown",
    invoice_date: cleanText(input.invoiceDate),
    due_date: cleanText(input.dueDate),
    honeybook_url: cleanText(input.honeybookUrl),
    source: input.source ?? "manual",
    review_status: "confirmed",
    imported_at: new Date().toISOString(),
  };
}

export async function loadProjectHoneyBookReferences(supabase: SupabaseClient<any>, projectId: string) {
  const { data, error } = await supabase
    .from("honeybook_financial_references")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function latestHoneyBookReference<TReference extends { updated_at?: string | null; created_at?: string | null }>(
  references: TReference[] | null | undefined,
) {
  return references?.[0] ?? null;
}
