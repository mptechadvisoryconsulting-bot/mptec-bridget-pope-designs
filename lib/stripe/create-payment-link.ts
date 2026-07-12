export async function createPaymentLink(metadata: Record<string, string>) {
  return {
    url: "",
    metadata,
    success: false,
    message: "Demo Stripe URLs are disabled. Use /api/stripe/create-checkout-session with an authenticated invoice.",
  };
}
