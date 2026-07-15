import type { SupabaseClient } from "@supabase/supabase-js";
import { first } from "@/lib/supabase/relations";

type AnyClient = SupabaseClient<any>;

async function logActivity(
  supabase: AnyClient,
  input: {
    actorId?: string | null;
    projectId?: string | null;
    leadId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    project_id: input.projectId ?? null,
    lead_id: input.leadId ?? null,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}

export type WorkflowResult = { success: boolean; message?: string; id?: string | null };

export const leadStatusLabels: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  consultation_scheduled: "Consultation Scheduled",
  consultation_completed: "Consultation Completed",
  awaiting_business_approval: "Awaiting Business Approval",
  approved: "Approved",
  converted: "Client Created",
  declined: "Declined",
  lost: "Lost",
  archived: "Archived",
};

export async function markLeadContacted(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "contacted", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "lead_contacted", entityType: "lead", entityId: leadId });
  return { success: true };
}

export async function archiveLead(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "lead_archived", entityType: "lead", entityId: leadId });
  return { success: true };
}

export async function scheduleLeadConsultation(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { data: existing } = await supabase
    .from("consultations")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 2);
  scheduledAt.setHours(10, 0, 0, 0);

  let consultationId: string | null = existing?.id ?? null;

  if (consultationId) {
    await supabase
      .from("consultations")
      .update({ status: "scheduled", scheduled_at: scheduledAt.toISOString(), updated_at: new Date().toISOString() })
      .eq("id", consultationId);
  } else {
    const { data: created, error } = await supabase
      .from("consultations")
      .insert({
        lead_id: leadId,
        scheduled_at: scheduledAt.toISOString(),
        meeting_type: "video",
        status: "scheduled",
        created_by: actorId ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, message: error.message };
    consultationId = created?.id ?? null;
  }

  await supabase
    .from("leads")
    .update({ status: "consultation_scheduled", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  await logActivity(supabase, { actorId, leadId, action: "consultation_scheduled", entityType: "consultation", entityId: consultationId });
  return { success: true, id: consultationId };
}

export async function completeLeadConsultation(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { data: consultation } = await supabase
    .from("consultations")
    .select("id")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (consultation?.id) {
    await supabase
      .from("consultations")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", consultation.id);
  }

  const { error } = await supabase
    .from("leads")
    .update({ status: "consultation_completed", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "consultation_completed", entityType: "lead", entityId: leadId });
  return { success: true, id: consultation?.id ?? null };
}

export async function markLeadAwaitingApproval(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "awaiting_business_approval", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "lead_awaiting_business_approval", entityType: "lead", entityId: leadId });
  return { success: true };
}

export async function approveLead(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "lead_approved", entityType: "lead", entityId: leadId });
  return { success: true };
}

export async function declineLead(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "lead_declined", entityType: "lead", entityId: leadId });
  return { success: true };
}

export async function markLeadLost(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("leads")
    .update({ status: "lost", updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, leadId, action: "lead_lost", entityType: "lead", entityId: leadId });
  return { success: true };
}

export async function convertLeadToClient(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult & { clientId?: string; projectId?: string; conversationId?: string; profileId?: string }> {
  const { provisionClientFromLead } = await import("@/lib/provisioning/provision-client");
  const result = await provisionClientFromLead(supabase as any, { leadId, actorId, inviteToPortal: true });

  if (!result.success) {
    return { success: false, message: result.message };
  }

  return {
    success: true,
    clientId: result.clientId,
    projectId: result.projectId,
    conversationId: result.conversationId,
    profileId: result.profileId,
    message: result.idempotent ? "Already converted" : undefined,
  };
}

export async function scheduleConsultation(
  supabase: AnyClient,
  consultationId: string,
  actorId: string | null | undefined,
  input: { scheduledAt?: string; meetingType?: string; meetingLink?: string; location?: string; notes?: string },
): Promise<WorkflowResult> {
  const updates: Record<string, unknown> = { status: "scheduled", updated_at: new Date().toISOString() };
  if (input.scheduledAt) updates.scheduled_at = new Date(input.scheduledAt).toISOString();
  if (input.meetingType) updates.meeting_type = input.meetingType;
  if (input.meetingLink !== undefined) updates.meeting_link = input.meetingLink || null;
  if (input.location !== undefined) updates.location = input.location || null;
  if (input.notes !== undefined) updates.notes = input.notes || null;

  const { data, error } = await supabase.from("consultations").update(updates).eq("id", consultationId).select("id,lead_id").maybeSingle();
  if (error) return { success: false, message: error.message };

  if (data?.lead_id) {
    await supabase.from("leads").update({ status: "consultation_scheduled", updated_at: new Date().toISOString() }).eq("id", data.lead_id);
  }

  await logActivity(supabase, { actorId, leadId: data?.lead_id, action: "consultation_scheduled", entityType: "consultation", entityId: consultationId });
  return { success: true };
}

export async function completeConsultation(supabase: AnyClient, consultationId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { data, error } = await supabase
    .from("consultations")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", consultationId)
    .select("id,lead_id")
    .maybeSingle();

  if (error) return { success: false, message: error.message };

  if (data?.lead_id) {
    await supabase.from("leads").update({ status: "consultation_completed", updated_at: new Date().toISOString() }).eq("id", data.lead_id);
  }

  await logActivity(supabase, { actorId, leadId: data?.lead_id, action: "consultation_completed", entityType: "consultation", entityId: consultationId });
  return { success: true };
}

export async function convertConsultationLead(supabase: AnyClient, consultationId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { data: consultation, error } = await supabase.from("consultations").select("id,lead_id").eq("id", consultationId).maybeSingle();
  if (error || !consultation?.lead_id) return { success: false, message: "No linked lead to convert." };
  return convertLeadToClient(supabase, consultation.lead_id, actorId);
}

export async function completeTask(supabase: AnyClient, taskId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "complete", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, action: "task_completed", entityType: "task", entityId: taskId });
  return { success: true };
}

export async function reopenTask(supabase: AnyClient, taskId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: "open", completed_at: null, updated_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return { success: false, message: error.message };
  await logActivity(supabase, { actorId, action: "task_reopened", entityType: "task", entityId: taskId });
  return { success: true };
}

export async function markNotificationRead(supabase: AnyClient, notificationId: string): Promise<WorkflowResult> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);
  if (error) return { success: false, message: error.message };
  return { success: true };
}

export async function markAllNotificationsRead(supabase: AnyClient): Promise<WorkflowResult> {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (error) return { success: false, message: error.message };
  return { success: true };
}

export async function sendContract(supabase: AnyClient, contractId: string, actorId?: string | null): Promise<WorkflowResult> {
  await logActivity(supabase, {
    actorId,
    action: "contract_send_blocked",
    entityType: "contract",
    entityId: contractId,
    metadata: { reason: "contracts_managed_in_honeybook" },
  });
  return { success: false, message: "Contracts are managed in HoneyBook. Open the linked HoneyBook project instead." };
}

export async function sendProposal(supabase: AnyClient, proposalId: string, actorId?: string | null): Promise<WorkflowResult> {
  await logActivity(supabase, {
    actorId,
    action: "proposal_send_blocked",
    entityType: "proposal",
    entityId: proposalId,
    metadata: { reason: "proposals_managed_in_honeybook" },
  });
  return { success: false, message: "Proposals are managed in HoneyBook. Open the linked HoneyBook project instead." };
}

export async function sendDesignUpdate(supabase: AnyClient, updateId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { data: update, error } = await supabase
    .from("design_updates")
    .select("id,title,project_id,bpd_projects(event_name,bpd_clients(profile_id))")
    .eq("id", updateId)
    .maybeSingle();

  if (error || !update) return { success: false, message: error?.message ?? "Design update not found." };

  await supabase
    .from("design_updates")
    .update({ status: "shared", client_visible: true, updated_at: new Date().toISOString() })
    .eq("id", updateId);

  const project = first(update.bpd_projects);
  const client = first(project?.bpd_clients);

  if (client?.profile_id) {
    await supabase.from("notifications").insert({
      recipient_id: client.profile_id,
      project_id: update.project_id,
      type: "design_update_shared",
      title: "New design update",
      message: `${update.title ?? "A design update"} has been shared to your portal.`,
      action_url: "/client/designs",
    });
  }

  await logActivity(supabase, { actorId, projectId: update.project_id, action: "design_update_shared", entityType: "design_update", entityId: updateId });
  return { success: true };
}
