import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const removedStripePaths = [
  "app/api/stripe",
  "app/api/webhooks/stripe",
  "lib/stripe.ts",
  "lib/billing/stripe.ts",
  "app/api/invoices/[invoiceId]/checkout/route.ts",
  "app/api/payments/checkout/route.ts",
];

describe("stripe routes removed", () => {
  it("does not keep critical Stripe route or library entrypoints", () => {
    for (const relative of removedStripePaths) {
      expect(existsSync(path.join(root, relative)), relative).toBe(false);
    }
  });
});
