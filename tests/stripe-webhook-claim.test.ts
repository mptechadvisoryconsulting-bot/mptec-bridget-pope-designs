import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { MAX_STRIPE_EVENT_RETRIES, claimStripeEvent, notifyAdmins } from "@/lib/stripe/webhook-events";

type StripeEventRow = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processing_status: string;
  claimed_at: string | null;
  processing_started_at: string | null;
  processed_at: string | null;
  processing_error: string | null;
  failed_at: string | null;
  retry_count: number;
  payload: unknown;
};

function makeEvent(id = "evt_123"): Stripe.Event {
  return { id, type: "checkout.session.completed" } as unknown as Stripe.Event;
}

/**
 * Minimal in-memory fake of the Supabase query builder chains `claimStripeEvent` relies on.
 * Every read/write against the `stripe_events` table runs synchronously inside a single
 * microtask so that concurrent `claimStripeEvent` calls issued via `Promise.all` exercise the
 * exact same compare-and-swap semantics the real Postgres UPDATE ... WHERE guarantees:
 * only one concurrent writer can flip a row from "failed" back to "processing".
 */
function createMockSupabase(seedRows: StripeEventRow[] = []) {
  const stripeEvents = new Map(seedRows.map((row) => [row.stripe_event_id, { ...row }]));
  let nextId = seedRows.length + 1;

  const stripeEventsTable = {
    insert(row: Partial<StripeEventRow>) {
      return Promise.resolve().then(() => {
        if (stripeEvents.has(row.stripe_event_id as string)) {
          return { error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        }

        stripeEvents.set(row.stripe_event_id as string, {
          id: String(nextId++),
          stripe_event_id: row.stripe_event_id as string,
          event_type: row.event_type as string,
          processing_status: row.processing_status as string,
          claimed_at: (row.claimed_at as string) ?? null,
          processing_started_at: (row.processing_started_at as string) ?? null,
          processed_at: null,
          processing_error: null,
          failed_at: null,
          retry_count: 0,
          payload: row.payload ?? null,
        });
        return { error: null };
      });
    },
    select() {
      const filters: [string, unknown][] = [];
      const builder = {
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        maybeSingle() {
          return Promise.resolve().then(() => {
            const match = [...stripeEvents.values()].find((row) => filters.every(([column, value]) => (row as any)[column] === value));
            return { data: match ?? null, error: null };
          });
        },
      };
      return builder;
    },
    update(patch: Partial<StripeEventRow>) {
      const filters: [string, unknown][] = [];
      const builder = {
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        select() {
          return {
            maybeSingle() {
              return Promise.resolve().then(() => {
                const match = [...stripeEvents.values()].find((row) => filters.every(([column, value]) => (row as any)[column] === value));
                if (!match) return { data: null, error: null };
                Object.assign(match, patch);
                return { data: { id: match.id }, error: null };
              });
            },
          };
        },
      };
      return builder;
    },
  };

  const from = vi.fn((table: string) => {
    if (table === "stripe_events") return stripeEventsTable;
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return { from, _store: stripeEvents };
}

describe("claimStripeEvent", () => {
  it("claims a brand-new event", async () => {
    const supabase = createMockSupabase();

    const result = await claimStripeEvent(supabase as any, makeEvent());

    expect(result).toEqual({ claimed: true });
    expect(supabase._store.get("evt_123")?.processing_status).toBe("processing");
  });

  it("does not reclaim an event that is already processing or processed", async () => {
    const supabase = createMockSupabase([
      {
        id: "1",
        stripe_event_id: "evt_123",
        event_type: "checkout.session.completed",
        processing_status: "processed",
        claimed_at: null,
        processing_started_at: null,
        processed_at: new Date().toISOString(),
        processing_error: null,
        failed_at: null,
        retry_count: 0,
        payload: null,
      },
    ]);

    const result = await claimStripeEvent(supabase as any, makeEvent());

    expect(result).toEqual({ claimed: false, processed: true, status: "processed" });
  });

  it("allows exactly one of two concurrent retries on a failed event to win", async () => {
    const supabase = createMockSupabase([
      {
        id: "1",
        stripe_event_id: "evt_123",
        event_type: "checkout.session.completed",
        processing_status: "failed",
        claimed_at: null,
        processing_started_at: null,
        processed_at: null,
        processing_error: "boom",
        failed_at: new Date().toISOString(),
        retry_count: 2,
        payload: null,
      },
    ]);

    const [first, second] = await Promise.all([
      claimStripeEvent(supabase as any, makeEvent()),
      claimStripeEvent(supabase as any, makeEvent()),
    ]);

    const outcomes = [first, second];
    const winners = outcomes.filter((outcome) => outcome.claimed);
    const losers = outcomes.filter((outcome) => !outcome.claimed);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toMatchObject({ claimed: false, processed: false, status: "already_retrying" });

    // Only the winner's retry should have been applied — retry_count increments exactly once.
    expect(supabase._store.get("evt_123")?.retry_count).toBe(3);
    expect(supabase._store.get("evt_123")?.processing_status).toBe("processing");
  });

  it("stops retrying once the retry limit is exceeded", async () => {
    const supabase = createMockSupabase([
      {
        id: "1",
        stripe_event_id: "evt_123",
        event_type: "checkout.session.completed",
        processing_status: "failed",
        claimed_at: null,
        processing_started_at: null,
        processed_at: null,
        processing_error: "boom",
        failed_at: new Date().toISOString(),
        retry_count: MAX_STRIPE_EVENT_RETRIES,
        payload: null,
      },
    ]);

    const result = await claimStripeEvent(supabase as any, makeEvent());

    expect(result).toEqual({ claimed: false, processed: false, status: "retry_limit_exceeded" });
    expect(supabase._store.get("evt_123")?.processing_status).toBe("failed");
  });
});

describe("notifyAdmins", () => {
  it("logs and does not throw when the notification insert fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              in: () => ({
                eq: () => Promise.resolve({ data: [{ id: "admin-1" }], error: null }),
              }),
            }),
          };
        }
        if (table === "notifications") {
          return {
            insert: () => Promise.resolve({ error: { code: "42501", message: "insert blocked" } }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await expect(
      notifyAdmins(supabase as any, { type: "test_event", title: "Test", message: "Test message" }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to insert admin notifications",
      expect.objectContaining({ type: "test_event", code: "42501" }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("skips the insert entirely when there are no active admin recipients", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return { select: () => ({ in: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }) };
        }
        if (table === "notifications") {
          return { insert: vi.fn() };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    await notifyAdmins(supabase as any, { type: "test_event", title: "Test", message: "Test message" });

    const notificationsTable = supabase.from("notifications") as { insert: ReturnType<typeof vi.fn> };
    expect(notificationsTable.insert).not.toHaveBeenCalled();
  });
});
