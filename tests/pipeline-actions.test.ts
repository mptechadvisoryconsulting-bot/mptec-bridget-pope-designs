import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { pipelineActions, pipelineStageLabels } from "@/lib/admin/pipeline-constants";
import { runPipelineAction } from "@/lib/admin/pipeline";

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
  return { supabase: { from } as never, calls };
}

vi.mock("@/lib/provisioning/provision-client", () => ({
  provisionClientFromLead: vi.fn(async () => ({
    success: true,
    profileId: "profile-1",
    clientId: "client-1",
    projectId: "project-1",
    conversationId: "conversation-1",
    idempotent: true,
    created: { profile: false, client: false, project: false, conversation: false, authInvite: false },
  })),
}));

describe("pipeline constants", () => {
  it("exposes the supported manual pipeline actions", () => {
    expect(pipelineActions).toEqual([
      "open_proposal",
      "proposal_sent",
      "proposal_approved",
      "invoice_paid",
      "project_started",
    ]);
  });

  it("labels proposal_sent and proposal_approved stages", () => {
    expect(pipelineStageLabels.proposal_sent).toBe("Proposal Sent");
    expect(pipelineStageLabels.proposal_approved).toBe("Proposal Approved");
    expect(pipelineStageLabels.proposal_workspace).toBe("Proposal Workspace");
  });
});

describe("runPipelineAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("open_proposal returns a proposal workspace URL and advances stage", async () => {
    const { supabase } = createMockSupabase({
      projects: [
        {
          data: {
            id: "project-1",
            lead_id: "lead-1",
            client_id: "client-1",
            event_name: "Garden Wedding",
            pipeline_stage: "proposal_draft",
            assigned_admin_id: "admin-1",
            status: "pending",
            bpd_clients: { profile_id: "client-profile" },
          },
          error: null,
        },
        { data: { id: "project-1", lead_id: "lead-1" }, error: null },
        { data: null, error: null },
      ],
      pipeline_events: [{ data: { id: "pe-1" }, error: null }],
      activity_logs: [{ data: null, error: null }],
      automation_logs: [{ data: null, error: null }],
      profiles: [{ data: [{ id: "owner-1" }], error: null }],
      notifications: [{ data: null, error: null }],
    });

    const result = await runPipelineAction(supabase, "project-1", {
      action: "open_proposal",
      actorId: "admin-1",
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe("proposal_workspace");
    expect(result.proposalUrl).toBe("/admin/proposals/new?projectId=project-1");
  });

  it("proposal_sent transitions to proposal_sent stage", async () => {
    const { supabase, calls } = createMockSupabase({
      projects: [
        {
          data: {
            id: "project-1",
            lead_id: "lead-1",
            client_id: "client-1",
            event_name: "Garden Wedding",
            pipeline_stage: "proposal_workspace",
            assigned_admin_id: "admin-1",
            status: "pending",
            bpd_clients: { profile_id: "client-profile" },
          },
          error: null,
        },
        { data: { id: "project-1", lead_id: "lead-1" }, error: null },
        { data: null, error: null },
      ],
      pipeline_events: [{ data: { id: "pe-2" }, error: null }],
      proposals: [{ data: null, error: null }],
      notifications: [{ data: null, error: null }, { data: null, error: null }],
      profiles: [{ data: [{ id: "owner-1" }], error: null }],
      activity_logs: [{ data: null, error: null }],
      automation_logs: [{ data: null, error: null }],
    });

    const result = await runPipelineAction(supabase, "project-1", {
      action: "proposal_sent",
      actorId: "admin-1",
      proposalId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe("proposal_sent");
    expect(calls.some((call) => call.table === "pipeline_events" && call.op === "insert")).toBe(true);
  });

  it("proposal_approved provisions from lead and advances stage", async () => {
    const { provisionClientFromLead } = await import("@/lib/provisioning/provision-client");
    const { supabase } = createMockSupabase({
      projects: [
        {
          data: {
            id: "project-1",
            lead_id: "lead-1",
            client_id: "client-1",
            event_name: "Garden Wedding",
            pipeline_stage: "proposal_sent",
            assigned_admin_id: "admin-1",
            status: "pending",
            bpd_clients: { profile_id: "client-profile" },
          },
          error: null,
        },
        { data: null, error: null },
        { data: { id: "project-1", lead_id: "lead-1" }, error: null },
        { data: null, error: null },
      ],
      proposals: [{ data: null, error: null }],
      pipeline_events: [{ data: { id: "pe-3" }, error: null }],
      notifications: [{ data: null, error: null }, { data: null, error: null }],
      profiles: [{ data: [{ id: "owner-1" }], error: null }],
      activity_logs: [{ data: null, error: null }],
      automation_logs: [{ data: null, error: null }],
    });

    const result = await runPipelineAction(supabase, "project-1", {
      action: "proposal_approved",
      actorId: "admin-1",
      proposalId: "11111111-1111-1111-1111-111111111111",
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe("proposal_approved");
    expect(result.provisioned).toBe(true);
    expect(provisionClientFromLead).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ leadId: "lead-1", inviteToPortal: true }),
    );
  });

  it("project_started sets planning/design status and pipeline stage", async () => {
    const { supabase, calls } = createMockSupabase({
      projects: [
        {
          data: {
            id: "project-1",
            lead_id: "lead-1",
            client_id: "client-1",
            event_name: "Garden Wedding",
            pipeline_stage: "proposal_approved",
            assigned_admin_id: "admin-1",
            status: "booked",
            bpd_clients: { profile_id: "client-profile" },
          },
          error: null,
        },
        { data: null, error: null },
        { data: { id: "project-1", lead_id: "lead-1" }, error: null },
        { data: null, error: null },
      ],
      pipeline_events: [{ data: { id: "pe-4" }, error: null }],
      notifications: [{ data: null, error: null }, { data: null, error: null }],
      profiles: [{ data: [{ id: "owner-1" }], error: null }],
      activity_logs: [{ data: null, error: null }],
      automation_logs: [{ data: null, error: null }],
    });

    const result = await runPipelineAction(supabase, "project-1", {
      action: "project_started",
      actorId: "admin-1",
    });

    expect(result.success).toBe(true);
    expect(result.stage).toBe("project_started");
    const statusUpdate = calls.find((call) => call.table === "projects" && call.op === "update");
    expect(statusUpdate?.args?.[0]).toMatchObject({ status: "planning" });
  });
});
