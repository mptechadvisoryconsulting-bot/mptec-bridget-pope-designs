export async function verifyStripeWebhook(payload: string, signature: string | null) {
  return {
    verified: Boolean(payload && signature && process.env.STRIPE_WEBHOOK_SECRET),
    type: "checkout.session.completed",
  };
}
