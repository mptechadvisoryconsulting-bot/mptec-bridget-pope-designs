import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<any>;

export type DeleteResult =
  | { success: true; message: string }
  | { success: false; status: number; message: string; dependents?: string[] };

export type ProjectDeleteSummary = {
  id: string;
  eventName: string;
  projectNumber: string | null;
  invoiceCount: number;
  paidInvoiceCount: number;
  proposalCount: number;
  conversationCount: number;
};

export type ClientDeleteSummary = {
  id: string;
  name: string;
  profileId: string | null;
  authUserId: string | null;
  projects: Array<{ id: string; eventName: string }>;
  invoiceCount: number;
  paidInvoiceCount: number;
};

function matchesConfirm(typed: string | undefined, expectedName: string) {
  const value = (typed ?? "").trim();
  if (!value) return false;
  if (value === "DELETE") return true;
  return value.toLowerCase() === expectedName.trim().toLowerCase();
}

async function deleteEq(supabase: AnyClient, table: string, column: string, value: string) {
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error && !/does not exist|schema cache/i.test(error.message ?? "")) {
    return error.message;
  }
  return null;
}

async function deleteIn(supabase: AnyClient, table: string, column: string, values: string[]) {
  if (!values.length) return null;
  const { error } = await supabase.from(table).delete().in(column, values);
  if (error && !/does not exist|schema cache/i.test(error.message ?? "")) {
    return error.message;
  }
  return null;
}

async function nullProjectRefs(supabase: AnyClient, projectId: string) {
  await supabase.from("clients").update({ active_project_id: null }).eq("active_project_id", projectId);
  await supabase.from("activity_logs").update({ project_id: null }).eq("project_id", projectId);
  await supabase.from("automation_logs").update({ project_id: null }).eq("project_id", projectId);
  await supabase.from("notifications").update({ project_id: null }).eq("project_id", projectId);
  await supabase.from("consultations").update({ project_id: null }).eq("project_id", projectId);
}

/**
 * Hard-deletes a project and related CRM/billing/message rows.
 * Cascade (application-level): messages → conversations, payments → invoices/items/versions,
 * proposal items → proposals, contracts, design updates/versions/feedback/approvals,
 * pipeline events, milestones, tasks, reminders, files, then the project.
 * Paid invoices are included when the caller confirms with DELETE/name — intended for test cleanup.
 */
export async function deleteProjectCascade(
  supabase: AnyClient,
  projectId: string,
  options?: { actorId?: string | null },
): Promise<DeleteResult> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,event_name,project_number,client_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) return { success: false, status: 400, message: projectError.message };
  if (!project) return { success: false, status: 404, message: "Project not found." };

  const { data: conversations } = await supabase.from("conversations").select("id").eq("project_id", projectId);
  const conversationIds = (conversations ?? []).map((row) => row.id);

  const { data: invoices } = await supabase.from("invoices").select("id").eq("project_id", projectId);
  const invoiceIds = (invoices ?? []).map((row) => row.id);

  const { data: proposals } = await supabase.from("proposals").select("id").eq("project_id", projectId);
  const proposalIds = (proposals ?? []).map((row) => row.id);

  const { data: designUpdates } = await supabase.from("design_updates").select("id").eq("project_id", projectId);
  const designUpdateIds = (designUpdates ?? []).map((row) => row.id);

  const failures: string[] = [];

  if (conversationIds.length) {
    const messageError = await deleteIn(supabase, "messages", "conversation_id", conversationIds);
    if (messageError) failures.push(`messages: ${messageError}`);
  }

  for (const step of [
    () => deleteEq(supabase, "conversations", "project_id", projectId),
    () => deleteEq(supabase, "event_reminders", "project_id", projectId),
    () => deleteEq(supabase, "pipeline_events", "project_id", projectId),
    () => deleteEq(supabase, "milestones", "project_id", projectId),
    () => deleteEq(supabase, "tasks", "project_id", projectId),
    () => deleteEq(supabase, "honeybook_financial_references", "project_id", projectId),
    () => deleteEq(supabase, "design_feedback", "project_id", projectId),
    () => deleteEq(supabase, "design_approvals", "project_id", projectId),
    () => deleteEq(supabase, "design_versions", "project_id", projectId),
    () => (designUpdateIds.length ? deleteIn(supabase, "design_updates", "id", designUpdateIds) : Promise.resolve(null)),
    () => deleteEq(supabase, "contracts", "project_id", projectId),
    () => (invoiceIds.length ? deleteIn(supabase, "payment_attempts", "invoice_id", invoiceIds) : Promise.resolve(null)),
    () => (invoiceIds.length ? deleteIn(supabase, "payments", "invoice_id", invoiceIds) : Promise.resolve(null)),
    () => deleteEq(supabase, "payments", "project_id", projectId),
    () => (invoiceIds.length ? deleteIn(supabase, "invoice_items", "invoice_id", invoiceIds) : Promise.resolve(null)),
    () => (invoiceIds.length ? deleteIn(supabase, "invoice_versions", "invoice_id", invoiceIds) : Promise.resolve(null)),
    () => (invoiceIds.length ? deleteIn(supabase, "invoices", "id", invoiceIds) : Promise.resolve(null)),
    () => (proposalIds.length ? deleteIn(supabase, "proposal_items", "proposal_id", proposalIds) : Promise.resolve(null)),
    () => (proposalIds.length ? deleteIn(supabase, "proposals", "id", proposalIds) : Promise.resolve(null)),
    () => deleteEq(supabase, "files", "project_id", projectId),
  ]) {
    const error = await step();
    if (error) failures.push(error);
  }

  await nullProjectRefs(supabase, projectId);

  if (project.client_id) {
    await supabase.from("clients").update({ active_project_id: null }).eq("id", project.client_id).eq("active_project_id", projectId);
  }

  const { error: deleteError } = await supabase.from("projects").delete().eq("id", projectId);
  if (deleteError) {
    return {
      success: false,
      status: 400,
      message: deleteError.message,
      dependents: failures.length ? failures : undefined,
    };
  }

  await supabase.from("activity_logs").insert({
    actor_id: options?.actorId ?? null,
    action: "project_deleted",
    entity_type: "project",
    entity_id: projectId,
    metadata: {
      event_name: project.event_name,
      project_number: project.project_number,
      invoice_count: invoiceIds.length,
      proposal_count: proposalIds.length,
    },
  });

  if (failures.length) {
    return {
      success: true,
      message: `Project deleted. Some related cleanup warnings: ${failures.slice(0, 3).join("; ")}`,
    };
  }

  return { success: true, message: "Project deleted." };
}

export async function getProjectDeleteSummary(supabase: AnyClient, projectId: string): Promise<ProjectDeleteSummary | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("id,event_name,project_number")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const [{ count: invoiceCount }, { count: paidInvoiceCount }, { count: proposalCount }, { count: conversationCount }] =
    await Promise.all([
      supabase.from("invoices").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .in("status", ["paid", "partially_paid", "refunded", "partially_refunded"]),
      supabase.from("proposals").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("conversations").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    ]);

  return {
    id: project.id,
    eventName: project.event_name,
    projectNumber: project.project_number ?? null,
    invoiceCount: invoiceCount ?? 0,
    paidInvoiceCount: paidInvoiceCount ?? 0,
    proposalCount: proposalCount ?? 0,
    conversationCount: conversationCount ?? 0,
  };
}

export async function deleteProjectWithConfirm(
  supabase: AnyClient,
  projectId: string,
  confirm: string | undefined,
  actorId?: string | null,
): Promise<DeleteResult> {
  const summary = await getProjectDeleteSummary(supabase, projectId);
  if (!summary) return { success: false, status: 404, message: "Project not found." };

  if (!matchesConfirm(confirm, summary.eventName)) {
    const dependents = [
      `${summary.invoiceCount} invoice(s)`,
      `${summary.proposalCount} proposal(s)`,
      `${summary.conversationCount} conversation(s)`,
    ];
    if (summary.paidInvoiceCount > 0) {
      dependents.unshift(`${summary.paidInvoiceCount} paid/settled invoice(s)`);
    }
    return {
      success: false,
      status: 400,
      message: `Type "${summary.eventName}" or DELETE to permanently delete this project and related records.`,
      dependents,
    };
  }

  if (summary.paidInvoiceCount > 0 && (confirm ?? "").trim() !== "DELETE") {
    return {
      success: false,
      status: 400,
      message: `This project has ${summary.paidInvoiceCount} paid/settled invoice(s). Type DELETE (exactly) to remove it anyway.`,
      dependents: [`${summary.paidInvoiceCount} paid/settled invoice(s)`],
    };
  }

  return deleteProjectCascade(supabase, projectId, { actorId });
}

export async function getClientDeleteSummary(supabase: AnyClient, clientId: string): Promise<ClientDeleteSummary | null> {
  const { data: client } = await supabase
    .from("clients")
    .select("id,profile_id,bpd_profiles(id,first_name,last_name,email,auth_user_id)")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return null;

  const profile = Array.isArray(client.bpd_profiles) ? client.bpd_profiles[0] : client.bpd_profiles;
  const name =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";

  const [{ data: projects }, { count: invoiceCount }, { count: paidInvoiceCount }] = await Promise.all([
    supabase.from("projects").select("id,event_name").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("status", ["paid", "partially_paid", "refunded", "partially_refunded"]),
  ]);

  return {
    id: client.id,
    name,
    profileId: client.profile_id ?? profile?.id ?? null,
    authUserId: profile?.auth_user_id ?? null,
    projects: (projects ?? []).map((project) => ({ id: project.id, eventName: project.event_name })),
    invoiceCount: invoiceCount ?? 0,
    paidInvoiceCount: paidInvoiceCount ?? 0,
  };
}

export async function deleteClientWithConfirm(
  supabase: AnyClient,
  clientId: string,
  input: { confirm?: string; cascade?: boolean; actorId?: string | null },
): Promise<DeleteResult> {
  const summary = await getClientDeleteSummary(supabase, clientId);
  if (!summary) return { success: false, status: 404, message: "Client not found." };

  const dependents = [
    ...summary.projects.map((project) => `Project: ${project.eventName}`),
    `${summary.invoiceCount} invoice(s)`,
  ];

  if (summary.projects.length > 0 && !input.cascade) {
    return {
      success: false,
      status: 409,
      message:
        "This client has related projects. Re-confirm with cascade enabled (or delete projects first).",
      dependents,
    };
  }

  if (!matchesConfirm(input.confirm, summary.name)) {
    return {
      success: false,
      status: 400,
      message: `Type "${summary.name}" or DELETE to permanently delete this client${
        summary.projects.length ? " and all related projects" : ""
      }.`,
      dependents,
    };
  }

  if (summary.paidInvoiceCount > 0 && (input.confirm ?? "").trim() !== "DELETE") {
    return {
      success: false,
      status: 400,
      message: `This client has ${summary.paidInvoiceCount} paid/settled invoice(s). Type DELETE (exactly) to remove them anyway.`,
      dependents,
    };
  }

  await supabase.from("clients").update({ active_project_id: null }).eq("id", clientId);

  for (const project of summary.projects) {
    const result = await deleteProjectCascade(supabase, project.id, { actorId: input.actorId });
    if (!result.success) return result;
  }

  // Conversations/invoices tied only by client_id should already be cleared via projects;
  // sweep any leftover client-scoped rows.
  await deleteEq(supabase, "conversations", "client_id", clientId);
  await deleteEq(supabase, "payments", "client_id", clientId);
  await deleteEq(supabase, "invoices", "client_id", clientId);

  const { error: clientError } = await supabase.from("clients").delete().eq("id", clientId);
  if (clientError) {
    return { success: false, status: 400, message: clientError.message, dependents };
  }

  if (summary.profileId) {
    await supabase.from("notifications").delete().eq("recipient_id", summary.profileId);
    // Keep the profile row (activity logs / messages may reference it); revoke portal access.
    await supabase
      .from("profiles")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", summary.profileId)
      .eq("role", "client");
  }

  if (summary.authUserId) {
    try {
      const { error: banError } = await supabase.auth.admin.updateUserById(summary.authUserId, {
        ban_duration: "876000h",
      });
      if (banError) {
        console.error("client_auth_user_ban_failed", { clientId, authUserId: summary.authUserId, message: banError.message });
      }
    } catch (error) {
      console.error("client_auth_user_ban_failed", {
        clientId,
        authUserId: summary.authUserId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await supabase.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    action: "client_deleted",
    entity_type: "client",
    entity_id: clientId,
    metadata: {
      name: summary.name,
      project_count: summary.projects.length,
      invoice_count: summary.invoiceCount,
    },
  });

  return {
    success: true,
    message: summary.projects.length
      ? `Client and ${summary.projects.length} related project(s) deleted.`
      : "Client deleted.",
  };
}

export async function deleteLeadWithConfirm(
  supabase: AnyClient,
  leadId: string,
  confirm: string | undefined,
  actorId?: string | null,
): Promise<DeleteResult> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id,first_name,last_name,lead_number,status")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) return { success: false, status: 404, message: "Lead not found." };

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.lead_number;

  const { data: client } = await supabase.from("clients").select("id").eq("lead_id", leadId).maybeSingle();
  if (client) {
    return {
      success: false,
      status: 409,
      message: "This lead was converted to a client. Delete the client record first (or archive the lead instead).",
      dependents: [`Client ${client.id}`],
    };
  }

  const { data: project } = await supabase.from("projects").select("id,event_name").eq("lead_id", leadId).maybeSingle();
  if (project) {
    return {
      success: false,
      status: 409,
      message: "This lead still has a linked project. Delete the project first (or archive the lead instead).",
      dependents: [`Project: ${project.event_name}`],
    };
  }

  if (!matchesConfirm(confirm, name)) {
    return {
      success: false,
      status: 400,
      message: `Type "${name}" or DELETE to permanently delete this consultation request.`,
    };
  }

  await supabase.from("consultations").delete().eq("lead_id", leadId);
  await supabase.from("notifications").delete().eq("lead_id", leadId);
  await supabase.from("files").update({ lead_id: null }).eq("lead_id", leadId);
  await supabase.from("activity_logs").update({ lead_id: null }).eq("lead_id", leadId);

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) return { success: false, status: 400, message: error.message };

  await supabase.from("activity_logs").insert({
    actor_id: actorId ?? null,
    action: "lead_deleted",
    entity_type: "lead",
    entity_id: leadId,
    metadata: { name, lead_number: lead.lead_number, previous_status: lead.status },
  });

  return { success: true, message: "Consultation request deleted." };
}

export function confirmMatchesName(typed: string | undefined, expectedName: string) {
  return matchesConfirm(typed, expectedName);
}
