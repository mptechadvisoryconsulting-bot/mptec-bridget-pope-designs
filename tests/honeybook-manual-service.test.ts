import { describe, expect, it, vi } from "vitest";
import { ManualHoneyBookService } from "@/lib/integrations/honeybook/manual-service";
import { toHoneyBookReferenceInsert } from "@/lib/honeybook/references";
import { honeybookIntegrationEventSchema, honeybookReferenceSchema } from "@/lib/validation/honeybook-schema";

type QueueItem = { data?: unknown; error?: unknown };
type Call = { table: string; op: string; args?: unknown[] };

function createTableBuilder(table: string, queue: QueueItem[], calls: Call[]) {
  const next = () => queue.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  const chain = (op: string) => (...args: unknown[]) => {
    calls.push({ table, op, args });
    return builder;
  };

  builder.select = chain("select");
  builder.eq = chain("eq");
  builder.in = chain("in");
  builder.contains = chain("contains");
  builder.order = chain("order");
  builder.limit = chain("limit");
  builder.insert = chain("insert");
  builder.update = chain("update");
  builder.maybeSingle = () => {
    calls.push({ table, op: "maybeSingle" });
    return Promise.resolve(next());
  };
  builder.single = () => {
    calls.push({ table, op: "single" });
    return Promise.resolve(next());
  };
  builder.then = (resolve: (value: QueueItem) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(next()).then(resolve, reject);

  return builder;
}

function createMockSupabase(tableQueues: Record<string, QueueItem[]>) {
  const queues = new Map<string, QueueItem[]>(Object.entries(tableQueues).map(([table, queue]) => [table, [...queue]]));
  const calls: Call[] = [];
  const from = vi.fn((table: string) => {
    if (!queues.has(table)) queues.set(table, []);
    return createTableBuilder(table, queues.get(table) as QueueItem[], calls);
  });
  return { supabase: { from } as never, calls, from };
}

describe("HoneyBook reference records", () => {
  it("normalizes manual reference values without creating payment authority", () => {
    const record = toHoneyBookReferenceInsert({
      projectId: "project-1",
      clientId: "client-1",
      honeybookProjectId: " HB-123 ",
      honeybookInvoiceNumber: " INV-2026 ",
      invoiceTotal: 1200.129,
      amountPaid: 300.335,
      balanceRemaining: -25,
      invoiceStatus: " sent ",
      honeybookUrl: " https://www.honeybook.com/ ",
      source: "manual",
    });

    expect(record).toMatchObject({
      project_id: "project-1",
      client_id: "client-1",
      honeybook_project_id: "HB-123",
      honeybook_invoice_number: "INV-2026",
      invoice_total: 1200.13,
      amount_paid: 300.34,
      balance_remaining: 0,
      invoice_status: "sent",
      honeybook_url: "https://www.honeybook.com/",
      source: "manual",
      review_status: "confirmed",
    });
  });

  it("validates future automation bridge events but does not require direct HoneyBook APIs", () => {
    const event = honeybookIntegrationEventSchema.parse({
      event_id: "zapier-event-1",
      event_type: "invoice.updated",
      occurred_at: "2026-07-15T12:00:00.000Z",
      honeybook_project_id: "HB-123",
      client_email: "client@example.com",
      invoice_number: "INV-10",
      invoice_total: "1000.00",
      amount_paid: "500.00",
      balance_remaining: "500.00",
      invoice_status: "partially_paid",
      due_date: "2026-08-01",
      honeybook_url: "https://www.honeybook.com/",
    });

    expect(event.invoice_total).toBe(1000);
    expect(event.amount_paid).toBe(500);
    expect(event.balance_remaining).toBe(500);
  });

  it("accepts only project-linked reference payloads", () => {
    const parsed = honeybookReferenceSchema.safeParse({
      projectId: "2f9ebc7e-b92e-4aac-b536-8d566ef504b6",
      clientId: "9605be46-6f67-4a32-8855-5cfc4a0030b1",
      honeybookInvoiceNumber: "HB-42",
      invoiceTotal: "2500",
      amountPaid: "1500",
      balanceRemaining: "1000",
      invoiceStatus: "sent",
      source: "manual",
    });

    expect(parsed.success).toBe(true);
  });
});

describe("ManualHoneyBookService", () => {
  it("marks pipeline stages on the project and inserts a pipeline event", async () => {
    const { supabase, calls } = createMockSupabase({
      projects: [
        { data: { id: "project-1", lead_id: "lead-1" }, error: null },
        { data: null, error: null },
      ],
      pipeline_events: [{ data: { id: "event-1" }, error: null }],
    });

    const service = new ManualHoneyBookService(supabase);
    const result = await service.markStage("proposal_sent", {
      projectId: "project-1",
      actorId: "admin-1",
      note: "Sent manually",
      source: "manual",
    });

    expect(result).toEqual({ stage: "proposal_sent", eventId: "event-1" });
    expect(calls.some((call) => call.table === "projects" && call.op === "update")).toBe(true);
    expect(calls.some((call) => call.table === "pipeline_events" && call.op === "insert")).toBe(true);
  });

  it("resolves open URL from project honeybook_url and marks honeybook_opened", async () => {
    const { supabase } = createMockSupabase({
      projects: [
        { data: { id: "project-1", honeybook_url: "https://www.honeybook.com/app/projects/1" }, error: null },
        { data: { id: "project-1", lead_id: null }, error: null },
        { data: null, error: null },
      ],
      pipeline_events: [{ data: { id: "event-open" }, error: null }],
    });

    const service = new ManualHoneyBookService(supabase);
    const result = await service.getOpenUrl({ projectId: "project-1", actorId: "admin-1" });

    expect(result.stage).toBe("honeybook_opened");
    expect(result.url).toBe("https://www.honeybook.com/app/projects/1");
  });
});
