"use server";

export async function createPaymentLink(invoiceId: string) {
  return {
    invoiceId,
    success: false,
    message: "Use the authenticated Stripe checkout API for production invoice payments.",
  };
}
