import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateApplicationFeeCents,
  normalizePlatformFeeBasisPoints,
} from "@/lib/payments/platform-fee";

const root = process.cwd();

const stripePaths = [
  "app/api/stripe/webhook/route.ts",
  "app/api/admin/payments/connect/route.ts",
  "app/api/invoices/[invoiceId]/checkout/route.ts",
  "lib/stripe/server.ts",
];

describe("Stripe Connect direct payments", () => {
  it("keeps the required server entrypoints in place", () => {
    for (const relative of stripePaths) {
      expect(existsSync(path.join(root, relative)), relative).toBe(true);
    }
  });

  it("calculates a one percent application fee from basis points", () => {
    expect(calculateApplicationFeeCents(100_00, 100)).toBe(100);
  });

  it("supports the agreed one to three percent site range", () => {
    expect(calculateApplicationFeeCents(100_00, 300)).toBe(300);
    expect(normalizePlatformFeeBasisPoints(200)).toBe(200);
  });

  it("uses the documented one-percent default when the fee is unset", () => {
    expect(normalizePlatformFeeBasisPoints(null)).toBe(100);
    expect(normalizePlatformFeeBasisPoints(undefined)).toBe(100);
    expect(normalizePlatformFeeBasisPoints("")).toBe(100);
    expect(normalizePlatformFeeBasisPoints("   ")).toBe(100);
  });

  it("rejects an application fee outside the agreed site range", () => {
    expect(() => normalizePlatformFeeBasisPoints(400)).toThrow(/between 1% and 3%/);
    expect(() => normalizePlatformFeeBasisPoints(50)).toThrow(/between 1% and 3%/);
  });
});
