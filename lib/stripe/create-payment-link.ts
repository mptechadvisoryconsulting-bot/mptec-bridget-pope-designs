export async function createPaymentLink(metadata: Record<string, string>) {
  return {
    url: "https://checkout.stripe.com/demo/bridget-pope-designs",
    metadata,
  };
}
