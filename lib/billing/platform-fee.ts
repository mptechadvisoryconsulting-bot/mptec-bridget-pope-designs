const DEFAULT_PLATFORM_FEE_BASIS_POINTS = 100;

export function parsePlatformFeeBasisPoints(value: string | number | null | undefined) {
  const raw = value ?? DEFAULT_PLATFORM_FEE_BASIS_POINTS;
  const parsed = typeof raw === "number" ? raw : Number(raw);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10_000) {
    throw new Error("PLATFORM_FEE_BASIS_POINTS must be an integer from 0 to 10000.");
  }

  return parsed;
}

export function resolvePlatformFeeBasisPoints(settings?: { platform_fee_basis_points?: number | string | null } | null) {
  return parsePlatformFeeBasisPoints(process.env.PLATFORM_FEE_BASIS_POINTS ?? settings?.platform_fee_basis_points ?? DEFAULT_PLATFORM_FEE_BASIS_POINTS);
}

export function calculatePlatformFeeCents(amountCents: number, basisPoints: number) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("Payment amount must be a non-negative integer number of cents.");
  }

  const bps = parsePlatformFeeBasisPoints(basisPoints);
  if (amountCents === 0 || bps === 0) return 0;

  const feeCents = Math.round((amountCents * bps) / 10_000);

  if (feeCents >= amountCents) {
    throw new Error("Platform fee must be less than the payment amount.");
  }

  return feeCents;
}
