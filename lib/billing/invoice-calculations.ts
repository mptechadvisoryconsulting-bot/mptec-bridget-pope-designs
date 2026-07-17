export type InvoiceCalculationItem = {
  title?: string;
  quantity: number;
  unitPrice: number;
};

export type CalculatedInvoiceItem<TItem extends InvoiceCalculationItem = InvoiceCalculationItem> = TItem & {
  totalCents: number;
  total: number;
};

export function toCents(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2));
}

export function calculateInvoiceTotals<TItem extends InvoiceCalculationItem>(
  items: TItem[],
  taxAmount = 0,
  discountAmount = 0,
) {
  const calculatedItems = items.map((item) => {
    const totalCents = Math.round(item.quantity * toCents(item.unitPrice));

    return {
      ...item,
      totalCents,
      total: fromCents(totalCents),
    };
  }) satisfies CalculatedInvoiceItem<TItem>[];

  const subtotalCents = calculatedItems.reduce((sum, item) => sum + item.totalCents, 0);
  const taxCents = toCents(taxAmount);
  const discountCents = toCents(discountAmount);
  const totalCents = Math.max(0, subtotalCents + taxCents - discountCents);

  return {
    items: calculatedItems,
    subtotalCents,
    taxCents,
    discountCents,
    totalCents,
    subtotal: fromCents(subtotalCents),
    taxAmount: fromCents(taxCents),
    discountAmount: fromCents(discountCents),
    total: fromCents(totalCents),
  };
}
