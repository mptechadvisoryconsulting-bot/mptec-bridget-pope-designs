import { describe, expect, it, vi } from "vitest";
import { provisionClientAccount, type SupabaseAdminLike } from "@/lib/admin/client-provisioning";

type QueueItem = { data?: unknown; error?: unknown };
type Call = { table: string; op: string };

function createTableBuilder(table: string, queue: QueueItem[], calls: Call[]) {
  const next = () => queue.shift() ?? { data: null, error: null };
  const builder: Record<string, unknown> = {};
  const chain = (op: string) => (...args: unknown[]) => {
    calls.push({ table, op });
    void args;
    return builder;
  };

  builder.select = chain("select");
  builder.eq = chain("eq");
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

  const supabase: SupabaseAdminLike = {
    from,
    auth: { admin: { inviteUserByEmail, deleteUser } },
  };

  return { supabase, calls, inviteUserByEmail, deleteUser };
}

const baseInput = {
  email: "ashley@example.com",
  username: "",
  firstName: "Ashley",
  lastName: "Johnson",
  phone: "",
  eventName: "Johnson Wedding",
  eventType: "Wedding",
  eventDate: "",
  venue: "",
  status: "planning" as const,
  adminProfileId: "admin-profile-1",
};

function deletesFor(calls: Call[], table: string) {
  return calls.filter((call) => call.table === table && call.op === "delete").length;
}

function insertsFor(calls: Call[], table: string) {
  return calls.filter((call) => call.table === table && call.op === "insert").length;
}

describe("provisionClientAccount", () => {
  it("invites the client by real email and provisions every relationship without ever returning a password", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase({
      profiles: [{ data: null, error: null }, { data: null, error: null }, { data: { id: "profile-1" }, error: null }],
      clients: [{ data: { id: "client-1" }, error: null }],
      projects: [{ data: { id: "project-1" }, error: null }],
      conversations: [{ data: { id: "conversation-1" }, error: null }],
      notifications: [{ data: null, error: null }],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");

    expect(result.profileId).toBe("profile-1");
    expect(result.clientId).toBe("client-1");
    expect(result.projectId).toBe("project-1");
    expect(result.conversationId).toBe("conversation-1");
    expect(result).not.toHaveProperty("password");
    expect(JSON.stringify(result).toLowerCase()).not.toContain("password");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(deletesFor(calls, "profiles")).toBe(0);
    expect(deletesFor(calls, "clients")).toBe(0);
    expect(deletesFor(calls, "projects")).toBe(0);
  });

  it("rejects the request before inviting when the email already has a portal account", async () => {
    const { supabase, inviteUserByEmail } = createMockSupabase({
      profiles: [{ data: { id: "existing-profile" }, error: null }],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.status).toBe(409);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("creates no relational rows and performs no compensation when the invite itself fails", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase(
      {
        profiles: [{ data: null, error: null }, { data: null, error: null }],
      },
      { data: { user: null }, error: { message: "invite failed" } },
    );

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.message).toBe("invite failed");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(insertsFor(calls, "profiles")).toBe(0);
    expect(insertsFor(calls, "clients")).toBe(0);
  });

  it("deletes the incomplete auth user when the profile insert fails", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase({
      profiles: [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: { message: "profile insert failed" } },
      ],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.message).toContain("profile");
    expect(deleteUser).toHaveBeenCalledWith("auth-user-1");
    expect(insertsFor(calls, "clients")).toBe(0);
    expect(insertsFor(calls, "projects")).toBe(0);
  });

  it("rolls back the profile and auth user when the client insert fails, leaving no orphaned profile", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase({
      profiles: [{ data: null, error: null }, { data: null, error: null }, { data: { id: "profile-1" }, error: null }],
      clients: [{ data: null, error: { message: "client insert failed" } }],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(deletesFor(calls, "profiles")).toBe(1);
    expect(deleteUser).toHaveBeenCalledWith("auth-user-1");
    expect(insertsFor(calls, "projects")).toBe(0);
  });

  it("rolls back the client, profile, and auth user when the project insert fails, leaving no orphaned client", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase({
      profiles: [{ data: null, error: null }, { data: null, error: null }, { data: { id: "profile-1" }, error: null }],
      clients: [{ data: { id: "client-1" }, error: null }],
      projects: [{ data: null, error: { message: "project insert failed" } }],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(deletesFor(calls, "clients")).toBe(1);
    expect(deletesFor(calls, "profiles")).toBe(1);
    expect(deleteUser).toHaveBeenCalledWith("auth-user-1");
    expect(insertsFor(calls, "conversations")).toBe(0);
  });

  it("rolls back the project, client, profile, and auth user when the conversation insert fails, proving no orphaned client relationships", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase({
      profiles: [{ data: null, error: null }, { data: null, error: null }, { data: { id: "profile-1" }, error: null }],
      clients: [{ data: { id: "client-1" }, error: null }],
      projects: [{ data: { id: "project-1" }, error: null }],
      conversations: [{ data: null, error: { message: "conversation insert failed" } }],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(deletesFor(calls, "projects")).toBe(1);
    expect(deletesFor(calls, "clients")).toBe(1);
    expect(deletesFor(calls, "profiles")).toBe(1);
    expect(deleteUser).toHaveBeenCalledWith("auth-user-1");
    expect(insertsFor(calls, "notifications")).toBe(0);
  });

  it("treats a failed welcome notification as non-fatal and does not roll back the completed portal", async () => {
    const { supabase, calls, deleteUser } = createMockSupabase({
      profiles: [{ data: null, error: null }, { data: null, error: null }, { data: { id: "profile-1" }, error: null }],
      clients: [{ data: { id: "client-1" }, error: null }],
      projects: [{ data: { id: "project-1" }, error: null }],
      conversations: [{ data: { id: "conversation-1" }, error: null }],
      notifications: [{ data: null, error: { message: "notification insert failed" } }],
    });

    const result = await provisionClientAccount(supabase, baseInput);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.warning).toBeTruthy();
    expect(result.profileId).toBe("profile-1");
    expect(deleteUser).not.toHaveBeenCalled();
    expect(deletesFor(calls, "profiles")).toBe(0);
    expect(deletesFor(calls, "clients")).toBe(0);
    expect(deletesFor(calls, "projects")).toBe(0);
  });
});
