import { describe, expect, it, vi } from "vitest";
import { provisionClientFromLead } from "@/lib/provisioning/provision-client";
import type { SupabaseAdminLike } from "@/lib/admin/client-provisioning";

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
  builder.ilike = chain("ilike");
  builder.order = chain("order");
  builder.limit = chain("limit");
  builder.insert = chain("insert");
  builder.update = chain("update");
  builder.delete = chain("delete");
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

function createMockSupabase(tableQueues: Record<string, QueueItem[]>, inviteResult?: { data: unknown; error: unknown }) {
  const queues = new Map<string, QueueItem[]>(Object.entries(tableQueues).map(([table, queue]) => [table, [...queue]]));
  const calls: Call[] = [];

  const from = vi.fn((table: string) => {
    if (!queues.has(table)) queues.set(table, []);
    return createTableBuilder(table, queues.get(table) as QueueItem[], calls);
  });

  const inviteUserByEmail = vi.fn(async () => inviteResult ?? { data: { user: { id: "auth-user-1" } }, error: null });
  const deleteUser = vi.fn(async () => ({ data: null, error: null }));
  const listUsers = vi.fn(async () => ({ data: { users: [] }, error: null }));

  const supabase: SupabaseAdminLike = {
    from,
    auth: { admin: { inviteUserByEmail, deleteUser, listUsers } },
  };

  return { supabase, calls, inviteUserByEmail, deleteUser, listUsers };
}

describe("provisionClientFromLead", () => {
  it("is idempotent when client, project, and conversation already exist for the lead", async () => {
    const { supabase, inviteUserByEmail, calls } = createMockSupabase({
      leads: [{ data: { id: "lead-1", email: "ashley@example.com", first_name: "Ashley", last_name: "Johnson", event_type: "Wedding", phone: "555" }, error: null }],
      clients: [
        { data: { id: "client-1", profile_id: "profile-1", lead_id: "lead-1", active_project_id: null }, error: null },
        { data: null, error: null }, // active_project_id update
      ],
      profiles: [{ data: { id: "profile-1", email: "ashley@example.com", auth_user_id: "auth-existing", first_name: "Ashley", last_name: "Johnson" }, error: null }],
      projects: [{ data: { id: "project-1", client_id: "client-1" }, error: null }],
      conversations: [{ data: { id: "conversation-1" }, error: null }],
      consultations: [{ data: null, error: null }],
      activity_logs: [{ data: null, error: null }],
    });

    const result = await provisionClientFromLead(supabase, { leadId: "lead-1", actorId: "admin-1", inviteToPortal: true });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.idempotent).toBe(true);
    expect(result.clientId).toBe("client-1");
    expect(result.projectId).toBe("project-1");
    expect(result.conversationId).toBe("conversation-1");
    expect(result.created.profile).toBe(false);
    expect(result.created.client).toBe(false);
    expect(result.created.project).toBe(false);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(calls.some((call) => call.table === "projects" && call.op === "insert")).toBe(false);
  });

  it("reuses an existing profile matched by email instead of creating a duplicate", async () => {
    const { supabase, calls } = createMockSupabase(
      {
        leads: [{ data: { id: "lead-2", email: "Ashley@Example.com", first_name: "Ashley", last_name: "Johnson", event_type: "Wedding", phone: "555" }, error: null }],
        clients: [
          { data: null, error: null }, // by lead_id
          { data: null, error: null }, // by profile after email match — none yet
          { data: { id: "client-2" }, error: null }, // insert client
          { data: null, error: null }, // active_project update
        ],
        profiles: [
          { data: { id: "profile-existing", email: "ashley@example.com", auth_user_id: null, first_name: "Ashley", last_name: "Johnson" }, error: null }, // eq email
          { data: null, error: null }, // invite link update
        ],
        projects: [
          { data: null, error: null }, // find by lead
          { data: { id: "project-2", client_id: "client-2" }, error: null }, // insert
        ],
        conversations: [
          { data: null, error: null },
          { data: { id: "conversation-2" }, error: null },
        ],
        consultations: [{ data: null, error: null }],
        notifications: [{ data: null, error: null }],
        activity_logs: [{ data: null, error: null }],
      },
      { data: { user: { id: "auth-new" } }, error: null },
    );

    const result = await provisionClientFromLead(supabase, { leadId: "lead-2", actorId: "admin-1" });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.profileId).toBe("profile-existing");
    expect(result.created.profile).toBe(false);
    expect(result.created.client).toBe(true);
    expect(result.created.project).toBe(true);
    expect(calls.filter((call) => call.table === "profiles" && call.op === "insert").length).toBe(0);
  });
});
