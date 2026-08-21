export const DEFAULT_PLATFORM_FEE_BASIS_POINTS = 100;
export const MIN_PLATFORM_FEE_BASIS_POINTS = 100;
export const MAX_PLATFORM_FEE_BASIS_POINTS = 300;

/**
 * Bridget's application fee is configured per site in bpd_business_settings.
 * Keep the runtime guard inside the agreed 1-3% range so a bad setting cannot
 * silently take an excessive fee from a client payment.
 */
export function normalizePlatformFeeBasisPoints(value: unknown) {
  if (value == null || (typeof value === "string" && !value.trim())) {
    return DEFAULT_PLATFORM_FEE_BASIS_POINTS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_PLATFORM_FEE_BASIS_POINTS;
  if (parsed < MIN_PLATFORM_FEE_BASIS_POINTS || parsed > MAX_PLATFORM_FEE_BASIS_POINTS) {
    throw new Error("Platform fee must be between 1% and 3%.");
  }
  return parsed;
}

export function calculateApplicationFeeCents(amountCents: number, basisPoints: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Payment amount must be a positive number of cents.");
  }
  const normalizedBasisPoints = normalizePlatformFeeBasisPoints(basisPoints);
  return Math.min(amountCents, Math.round((amountCents * normalizedBasisPoints) / 10_000));
}

export function basisPointsToPercent(basisPoints: number) {
  return normalizePlatformFeeBasisPoints(basisPoints) / 100;
}
