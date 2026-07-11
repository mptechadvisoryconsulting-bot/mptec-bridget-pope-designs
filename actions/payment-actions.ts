"use server";

export async function createPaymentLink(invoiceId: string) {
  return { invoiceId, url: "https://checkout.stripe.com/demo/bridget-pope-designs" };
}
