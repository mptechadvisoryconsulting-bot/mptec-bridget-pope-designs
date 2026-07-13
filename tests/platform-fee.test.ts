import { describe, expect, it } from "vitest";
import { calculatePlatformFeeCents, parsePlatformFeeBasisPoints } from "@/lib/billing/platform-fee";

describe("platform fee calculations", () => {
  it.each([
    [100, 1],
    [1_000, 10],
    [10_000, 100],
    [100_000, 1_000],
    [1_000_000, 10_000],
    [12_345, 123],
    [2_499, 24],
  ])("calculates a 1 percent fee for %i cents", (amountCents, expectedFeeCents) => {
    expect(calculatePlatformFeeCents(amountCents, 100)).toBe(expectedFeeCents);
  });

  it("returns zero for zero-dollar payments", () => {
    expect(calculatePlatformFeeCents(0, 100)).toBe(0);
  });

  it("rejects negative payments", () => {
    expect(() => calculatePlatformFeeCents(-1, 100)).toThrow(/non-negative/);
  });

  it("rejects fees equal to or greater than the payment", () => {
    expect(() => calculatePlatformFeeCents(100, 10_000)).toThrow(/less than the payment/);
  });

  it("validates configured basis points", () => {
    expect(parsePlatformFeeBasisPoints("100")).toBe(100);
    expect(() => parsePlatformFeeBasisPoints("100.5")).toThrow(/integer/);
    expect(() => parsePlatformFeeBasisPoints("10001")).toThrow(/integer/);
  });
});
