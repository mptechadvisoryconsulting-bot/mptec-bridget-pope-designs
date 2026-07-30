export type OfflinePaymentSettings = {
  cashAppHandle?: string | null;
  zelleHandle?: string | null;
  venmoHandle?: string | null;
  bankTransferNotes?: string | null;
  checkPayableTo?: string | null;
  paymentInstructionsNotes?: string | null;
};

export type OfflinePaymentLine = {
  label: string;
  value: string;
};

export function offlinePaymentLines(settings: OfflinePaymentSettings | null | undefined): OfflinePaymentLine[] {
  if (!settings) return [];
  const lines: OfflinePaymentLine[] = [];
  const cashApp = settings.cashAppHandle?.trim();
  const zelle = settings.zelleHandle?.trim();
  const venmo = settings.venmoHandle?.trim();
  const bank = settings.bankTransferNotes?.trim();
  const checkTo = settings.checkPayableTo?.trim();
  const notes = settings.paymentInstructionsNotes?.trim();

  if (cashApp) lines.push({ label: "Cash App", value: cashApp });
  if (zelle) lines.push({ label: "Zelle", value: zelle });
  if (venmo) lines.push({ label: "Venmo", value: venmo });
  if (checkTo) lines.push({ label: "Checks payable to", value: checkTo });
  if (bank) lines.push({ label: "Bank transfer", value: bank });
  if (notes) lines.push({ label: "Notes", value: notes });
  return lines;
}

export function formatOfflinePaymentInstructions(
  settings: OfflinePaymentSettings | null | undefined,
): string | null {
  const lines = offlinePaymentLines(settings);
  if (!lines.length) return null;
  return lines.map((line) => `${line.label}: ${line.value}`).join("\n");
}

export function mapBusinessSettingsPaymentFields(row: Record<string, unknown> | null | undefined): OfflinePaymentSettings {
  if (!row) return {};
  return {
    cashAppHandle: (row.cash_app_handle as string | null | undefined) ?? null,
    zelleHandle: (row.zelle_handle as string | null | undefined) ?? null,
    venmoHandle: (row.venmo_handle as string | null | undefined) ?? null,
    bankTransferNotes: (row.bank_transfer_notes as string | null | undefined) ?? null,
    checkPayableTo: (row.check_payable_to as string | null | undefined) ?? null,
    paymentInstructionsNotes: (row.payment_instructions_notes as string | null | undefined) ?? null,
  };
}

export const offlinePaymentSettingsSelect =
  "cash_app_handle,zelle_handle,venmo_handle,bank_transfer_notes,check_payable_to,payment_instructions_notes";

export async function loadOfflinePaymentSettings(supabase: {
  from: (table: string) => any;
}): Promise<OfflinePaymentSettings> {
  const { data } = await supabase.from("business_settings").select(offlinePaymentSettingsSelect).limit(1).maybeSingle();
  return mapBusinessSettingsPaymentFields(data as Record<string, unknown> | null);
}
