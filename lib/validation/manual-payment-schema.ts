import { z } from "zod";

export const MANUAL_PAYMENT_METHODS = [
  "cash",
  "check",
  "bank_transfer",
  "external_card",
  "other",
  "zelle",
  "venmo",
] as const;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

const methodAliases: Record<string, ManualPaymentMethod> = {
  card_external: "external_card",
  card: "external_card",
  wire: "bank_transfer",
  ach: "bank_transfer",
};

export const manualPaymentMethodLabels: Record<ManualPaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  bank_transfer: "Bank transfer",
  external_card: "Card (outside site)",
  other: "Other",
  zelle: "Zelle",
  venmo: "Venmo",
};

export function normalizeManualPaymentMethod(value: string): ManualPaymentMethod | null {
  const raw = value.trim().toLowerCase();
  if ((MANUAL_PAYMENT_METHODS as readonly string[]).includes(raw)) return raw as ManualPaymentMethod;
  return methodAliases[raw] ?? null;
}

export const manualPaymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero").max(1_000_000, "Amount is too large"),
  paidAt: z.string().min(1, "Payment date is required"),
  paymentMethod: z
    .string()
    .transform((value, ctx) => {
      const normalized = normalizeManualPaymentMethod(value);
      if (!normalized) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid payment method" });
        return z.NEVER;
      }
      return normalized;
    }),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;
