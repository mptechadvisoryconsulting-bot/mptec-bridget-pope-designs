import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStripe } from "@/lib/stripe/client";

vi.mock("@/lib/stripe/client", () => ({
  getStripe: vi.fn(),
}));

const mockedGetStripe = vi.mocked(getStripe);

/**
 * Minimal in-memory fake of the `business_settings` Supabase query builder chains that
 * `lib/stripe/connect.ts` relies on. Implements just enough of the PostgREST `.or()` filter
 * grammar (`col.is.null`, `col.in.(a,b)`, `col.eq.value`, `col.lt.value`, `and(...)`) to
 * faithfully exercise the same compare-and-swap semantics the real Supabase UPDATE ... WHERE
 * guarantees, matching the pattern used by tests/stripe-webhook-claim.test.ts.
 */
function createMockSettingsSupabase(initialRow: Record<string, unknown>) {
  let row: Record<string, unknown> | null = { ...initialRow };
  let createCalls = 0;

  function splitTopLevel(input: string) {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of input) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        parts.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    if (current) parts.push(current);
    return parts;
  }

  function evalCondition(condition: string, target: Record<string, unknown>) {
    const [column, op, ...rest] = condition.split(".");
    // Strip PostgREST-quoted values (e.g. ISO timestamps with `:` / `+`).
    const raw = rest.join(".");
    const value = raw.replace(/^"(.*)"$/, "$1");
    const actual = target[column];

    if (op === "is") return value === "null" ? actual === null || actual === undefined : String(actual) === value;
    if (op === "in") return value.replace(/^\(|\)$/g, "").split(",").includes(String(actual));
    if (op === "eq") return String(actual) === value;
    if (op === "lt") return typeof actual === "string" && actual < value;
    return false;
  }

  function evalOrExpression(expression: string, target: Record<string, unknown>): boolean {
    return splitTopLevel(expression).some((part) => {
      if (part.startsWith("and(")) {
        return splitTopLevel(part.slice(4, -1)).every((sub) => evalCondition(sub, target));
      }
      return evalCondition(part, target);
    });
  }

  const businessSettingsTable = {
    select() {
      const builder = {
        limit() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: row ? { ...row } : null, error: null });
        },
      };
      return builder;
    },
    insert(patch: Record<string, unknown>) {
      createCalls += 1;
      row = { id: (row?.id as string) ?? "settings-1", ...patch };
      return {
        select() {
          return {
            single() {
              return Promise.resolve({ data: { ...row }, error: null });
            },
          };
        },
      };
    },
    update(patch: Record<string, unknown>) {
      const eqFilters: [string, unknown][] = [];
      const isFilters: [string, unknown][] = [];
      let orExpression: string | null = null;

      const builder = {
        eq(column: string, value: unknown) {
          eqFilters.push([column, value]);
          return builder;
        },
        is(column: string, value: unknown) {
          isFilters.push([column, value]);
          return builder;
        },
        or(expression: string) {
          orExpression = expression;
          return builder;
        },
        select() {
          return {
            maybeSingle: () => finalize(),
            single: () => finalize(),
          };
        },
      };

      function finalize() {
        return Promise.resolve().then(() => {
          if (!row) return { data: null, error: null };

          const eqOk = eqFilters.every(([column, value]) => row![column] === value);
          const isOk = isFilters.every(([column, value]) => (value === null ? row![column] === null || row![column] === undefined : row![column] === value));
          const orOk = orExpression ? evalOrExpression(orExpression, row) : true;

          if (eqOk && isOk && orOk) {
            row = { ...row, ...patch };
            return { data: { ...row }, error: null };
          }

          return { data: null, error: null };
        });
      }

      return builder;
    },
  };

  const from = vi.fn((table: string) => {
    if (table === "business_settings") return businessSettingsTable;
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return {
    from,
    _getRow: () => (row ? { ...row } : null),
    _createCalls: () => createCalls,
  };
}

function makeStripeAccount(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "acct_default",
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    requirements: { currently_due: [], disabled_reason: null },
    metadata: { business: "bridget-pope-designs", provisioning_key: "key-default" },
    ...overrides,
  };
}

function stripeError(overrides: Record<string, unknown>) {
  const error = new Error((overrides.message as string) ?? "Stripe error");
  Object.assign(error, overrides);
  return error;
}

describe("ensureStripeConnectAccount", () => {
  beforeEach(() => {
    mockedGetStripe.mockReset();
  });

  it("reuses an existing connected account and never calls accounts.create()", async () => {
    const retrieve = vi.fn().mockResolvedValue(makeStripeAccount({ id: "acct_existing" }));
    const create = vi.fn();
    mockedGetStripe.mockReturnValue({ accounts: { retrieve, create, list: vi.fn() } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: "acct_existing",
      stripe_connect_provisioning_status: "ready",
    });

    const result = await ensureStripeConnectAccount(supabase as never);

    expect(retrieve).toHaveBeenCalledWith("acct_existing");
    expect(create).not.toHaveBeenCalled();
    expect(result.stripe_connected_account_id).toBe("acct_existing");
  });

  it("fails closed without clearing or overwriting the stored id when the account is resource_missing", async () => {
    const retrieve = vi.fn().mockRejectedValue(
      stripeError({ type: "StripeInvalidRequestError", code: "resource_missing", message: "No such account: acct_gone" }),
    );
    const create = vi.fn();
    mockedGetStripe.mockReturnValue({ accounts: { retrieve, create, list: vi.fn() } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: "acct_gone",
      stripe_connect_provisioning_status: "ready",
    });

    await expect(ensureStripeConnectAccount(supabase as never)).rejects.toMatchObject({
      stage: "connect_account_retrieve",
      safeCode: "STRIPE_CONNECTED_ACCOUNT_ERROR",
    });

    expect(create).not.toHaveBeenCalled();
    // The stored account id must still be present — never silently cleared or overwritten.
    expect(supabase._getRow()?.stripe_connected_account_id).toBe("acct_gone");
  });

  it("recovers an orphaned account by provisioning key instead of creating a duplicate", async () => {
    const orphanedAccount = makeStripeAccount({ id: "acct_recovered", metadata: { business: "bridget-pope-designs", provisioning_key: "key-abc" } });
    const list = vi.fn().mockResolvedValue({ data: [orphanedAccount], has_more: false });
    const create = vi.fn();
    const retrieve = vi.fn();
    mockedGetStripe.mockReturnValue({ accounts: { retrieve, create, list } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "provisioning",
      stripe_connect_provisioning_key: "key-abc",
      stripe_connect_provisioning_started_at: new Date().toISOString(),
    });

    const result = await ensureStripeConnectAccount(supabase as never);

    expect(create).not.toHaveBeenCalled();
    expect(result.stripe_connected_account_id).toBe("acct_recovered");
  });

  it("fails closed for operator review when provisioning recovery matches more than one account", async () => {
    const matchA = makeStripeAccount({ id: "acct_a", metadata: { business: "bridget-pope-designs", provisioning_key: "key-dup" } });
    const matchB = makeStripeAccount({ id: "acct_b", metadata: { business: "bridget-pope-designs", provisioning_key: "key-dup" } });
    const list = vi.fn().mockResolvedValue({ data: [matchA, matchB], has_more: false });
    const create = vi.fn();
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "provisioning",
      stripe_connect_provisioning_key: "key-dup",
      stripe_connect_provisioning_started_at: new Date().toISOString(),
    });

    await expect(ensureStripeConnectAccount(supabase as never)).rejects.toMatchObject({
      stage: "connect_account_recover",
      safeCode: "STRIPE_PROVISIONING_CONFLICT",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("returns a provisioning-in-progress conflict when another request holds a fresh lease and no account matches", async () => {
    const list = vi.fn().mockResolvedValue({ data: [], has_more: false });
    const create = vi.fn();
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "provisioning",
      stripe_connect_provisioning_key: "key-fresh",
      stripe_connect_provisioning_started_at: new Date().toISOString(),
    });

    await expect(ensureStripeConnectAccount(supabase as never)).rejects.toMatchObject({
      stage: "connect_provisioning_claim",
      safeCode: "STRIPE_PROVISIONING_IN_PROGRESS",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("reclaims a stale provisioning lease and creates exactly one new account when nothing matches", async () => {
    const list = vi.fn().mockResolvedValue({ data: [], has_more: false });
    const created = makeStripeAccount({ id: "acct_new" });
    const create = vi.fn().mockResolvedValue(created);
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const staleStartedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago > 15 minute lease
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "provisioning",
      stripe_connect_provisioning_key: "key-stale",
      stripe_connect_provisioning_started_at: staleStartedAt,
    });

    const result = await ensureStripeConnectAccount(supabase as never);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.stripe_connected_account_id).toBe("acct_new");
  });

  it("soft-fails recovery on StripeConnectionError for a stale lease and still creates one account", async () => {
    const list = vi.fn().mockRejectedValue({ type: "StripeConnectionError", message: "An error occurred with our connection to Stripe. Request was retried 2 times." });
    const created = makeStripeAccount({ id: "acct_after_soft_recover" });
    const create = vi.fn().mockResolvedValue(created);
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const staleStartedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "provisioning",
      stripe_connect_provisioning_key: "key-stale",
      stripe_connect_provisioning_started_at: staleStartedAt,
    });

    const result = await ensureStripeConnectAccount(supabase as never);

    expect(list).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(result.stripe_connected_account_id).toBe("acct_after_soft_recover");
  });

  it("soft-fails recovery on StripeConnectionError when status is failed and creates one account", async () => {
    const list = vi.fn().mockRejectedValue({ type: "StripeConnectionError", message: "An error occurred with our connection to Stripe. Request was retried 2 times." });
    const created = makeStripeAccount({ id: "acct_after_failed_status" });
    const create = vi.fn().mockResolvedValue(created);
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "failed",
      stripe_connect_provisioning_key: "key-failed",
      stripe_connect_provisioning_started_at: new Date().toISOString(),
    });

    const result = await ensureStripeConnectAccount(supabase as never);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.stripe_connected_account_id).toBe("acct_after_failed_status");
  });

  it("claims a brand-new provisioning lease and creates exactly one account for a not_started row", async () => {
    const created = makeStripeAccount({ id: "acct_brand_new" });
    const create = vi.fn().mockResolvedValue(created);
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list: vi.fn() } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "not_started",
      stripe_connect_provisioning_key: null,
      stripe_connect_provisioning_started_at: null,
    });

    const result = await ensureStripeConnectAccount(supabase as never);

    expect(create).toHaveBeenCalledTimes(1);
    expect(result.stripe_connected_account_id).toBe("acct_brand_new");
  });

  it("allows exactly one of two concurrent requests to create an account for the same not_started row", async () => {
    let createCount = 0;
    const create = vi.fn().mockImplementation(async () => {
      createCount += 1;
      return makeStripeAccount({ id: `acct_concurrent_${createCount}` });
    });
    mockedGetStripe.mockReturnValue({ accounts: { retrieve: vi.fn(), create, list: vi.fn() } } as never);

    const { ensureStripeConnectAccount } = await import("@/lib/stripe/connect");
    const supabase = createMockSettingsSupabase({
      id: "settings-1",
      stripe_connected_account_id: null,
      stripe_connect_provisioning_status: "not_started",
      stripe_connect_provisioning_key: null,
      stripe_connect_provisioning_started_at: null,
    });

    const outcomes = await Promise.allSettled([
      ensureStripeConnectAccount(supabase as never),
      ensureStripeConnectAccount(supabase as never),
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

    expect(create).toHaveBeenCalledTimes(1);
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ safeCode: "STRIPE_PROVISIONING_IN_PROGRESS" });
    expect(supabase._getRow()?.stripe_connected_account_id).toBe("acct_concurrent_1");
  });
});
