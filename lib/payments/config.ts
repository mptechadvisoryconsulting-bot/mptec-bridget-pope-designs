export const REFUND_PLATFORM_FEE_POLICIES = ["retain", "proportional_refund"] as const;
export type RefundPlatformFeePolicy = (typeof REFUND_PLATFORM_FEE_POLICIES)[number];

export function paymentCreationEnabled() {
  return process.env.PAYMENT_CREATION_ENABLED === "true";
}

export function paymentCreationDisabledMessage() {
  return "Online payment is temporarily unavailable while payment setup is being verified. Please try again shortly.";
}

export function refundPlatformFeePolicy(): RefundPlatformFeePolicy {
  const value = process.env.REFUND_PLATFORM_FEE_POLICY ?? "retain";
  return REFUND_PLATFORM_FEE_POLICIES.includes(value as RefundPlatformFeePolicy) ? (value as RefundPlatformFeePolicy) : "retain";
}
