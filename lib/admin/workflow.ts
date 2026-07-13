import type { SupabaseClient } from "@supabase/supabase-js";
import { emailSubjects } from "@/lib/email/templates";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { appUrl } from "@/lib/env";
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

async function businessSettings(supabase: AnyClient) {
  const { data } = await supabase
    .from("business_settings")
    .select("id,business_email,invoice_reply_to,inquiry_recipient_email,invoice_notifications_enabled")
    .limit(1)
    .maybeSingle();
  return data;
}

export type WorkflowResult = { success: boolean; message?: string; id?: string | null };

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

export async function convertLeadToClient(supabase: AnyClient, leadId: string, actorId?: string | null): Promise<WorkflowResult & { clientId?: string; projectId?: string }> {
  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
  if (leadError || !lead) return { success: false, message: leadError?.message ?? "Lead not found." };

  const { data: existingClient } = await supabase.from("clients").select("id,profile_id").eq("lead_id", leadId).maybeSingle();
  let clientId: string | undefined = existingClient?.id;
  let profileId: string | undefined = existingClient?.profile_id;

  if (!clientId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        role: "client",
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        active: true,
      })
      .select("id")
      .single();

    if (profileError || !profile) return { success: false, message: profileError?.message ?? "Unable to create client profile." };
    profileId = profile.id;

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({ profile_id: profileId, lead_id: leadId })
      .select("id")
      .single();

    if (clientError || !client) return { success: false, message: clientError?.message ?? "Unable to create client record." };
    clientId = client.id;
  }

  const { data: existingProject } = await supabase.from("projects").select("id").eq("lead_id", leadId).maybeSingle();
  let projectId: string | undefined = existingProject?.id;

  if (!projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: clientId,
        lead_id: leadId,
        event_name: [lead.first_name, lead.last_name, lead.event_type].filter(Boolean).join(" ").trim() || "New Event",
        event_type: lead.event_type,
        event_date: lead.event_date,
        venue_name: lead.venue,
        city: lead.city,
        guest_count: lead.guest_count,
        budget: lead.estimated_budget,
        color_palette: lead.event_colors,
        theme: lead.event_theme,
        status: "pending",
        assigned_admin_id: actorId ?? null,
      })
      .select("id")
      .single();

    if (projectError || !project) return { success: false, message: projectError?.message ?? "Unable to create project." };
    projectId = project.id;

    await supabase.from("conversations").insert({ project_id: projectId, client_id: clientId });
  }

  await supabase.from("leads").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", leadId);

  if (profileId) {
    await supabase.from("notifications").insert({
      recipient_id: profileId,
      project_id: projectId,
      lead_id: leadId,
      type: "portal_created",
      title: "Your project workspace is ready",
      message: "Bridget Pope Designs has started your project workspace.",
      action_url: "/client/dashboard",
    });
  }

  await logActivity(supabase, { actorId, leadId, projectId, action: "lead_converted", entityType: "project", entityId: projectId });
  return { success: true, clientId, projectId };
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
  const { data: contract, error } = await supabase
    .from("contracts")
    .select("id,status,contract_number,project_id,bpd_projects(event_name,bpd_clients(profile_id,bpd_profiles(first_name,last_name,email)))")
    .eq("id", contractId)
    .maybeSingle();

  if (error || !contract) return { success: false, message: error?.message ?? "Contract not found." };

  const nextStatus = contract.status === "draft" ? "sent" : contract.status;
  await supabase.from("contracts").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", contractId);

  const project = first(contract.bpd_projects);
  const client = first(project?.bpd_clients);
  const profile = first(client?.bpd_profiles);
  const clientEmail = profile?.email;
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "there";

  if (client?.profile_id) {
    await supabase.from("notifications").insert({
      recipient_id: client.profile_id,
      project_id: contract.project_id,
      type: "contract_sent",
      title: "Contract ready for signature",
      message: `${contract.contract_number ?? "Your contract"} is ready to review and sign.`,
      action_url: "/client/contracts",
    });
  }

  let emailStatus = "not_configured";
  if (clientEmail) {
    const settings = await businessSettings(supabase);
    const result = await sendTrackedEmail({
      supabase,
      settingsId: settings?.id,
      from: emailFrom(),
      to: clientEmail,
      replyTo: settings?.invoice_reply_to ?? settings?.business_email ?? undefined,
      subject: emailSubjects.contractReady,
      html: `<p>Hello ${clientName},</p><p>Your contract ${contract.contract_number ?? ""} for ${project?.event_name ?? "your event"} is ready to review and sign.</p><p><a href="${appUrl()}/client/contracts">Review your contract</a></p>`,
    });
    emailStatus = result.status;
  }

  await logActivity(supabase, { actorId, projectId: contract.project_id, action: "contract_sent", entityType: "contract", entityId: contractId, metadata: { emailStatus } });
  return { success: true, message: emailStatus };
}

export async function sendProposal(supabase: AnyClient, proposalId: string, actorId?: string | null): Promise<WorkflowResult> {
  const { data: proposal, error } = await supabase
    .from("proposals")
    .select("id,status,proposal_number,title,total,project_id,bpd_projects(event_name,bpd_clients(profile_id,bpd_profiles(first_name,last_name,email)))")
    .eq("id", proposalId)
    .maybeSingle();

  if (error || !proposal) return { success: false, message: error?.message ?? "Proposal not found." };

  const nextStatus = proposal.status === "draft" ? "sent" : proposal.status;
  await supabase.from("proposals").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", proposalId);

  const project = first(proposal.bpd_projects);
  const client = first(project?.bpd_clients);
  const profile = first(client?.bpd_profiles);
  const clientEmail = profile?.email;
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "there";

  if (client?.profile_id) {
    await supabase.from("notifications").insert({
      recipient_id: client.profile_id,
      project_id: proposal.project_id,
      type: "proposal_sent",
      title: "Proposal ready for review",
      message: `${proposal.title ?? proposal.proposal_number ?? "Your proposal"} is ready to review.`,
      action_url: "/client/proposals",
    });
  }

  let emailStatus = "not_configured";
  if (clientEmail) {
    const settings = await businessSettings(supabase);
    const result = await sendTrackedEmail({
      supabase,
      settingsId: settings?.id,
      from: emailFrom(),
      to: clientEmail,
      replyTo: settings?.invoice_reply_to ?? settings?.business_email ?? undefined,
      subject: emailSubjects.proposalSent,
      html: `<p>Hello ${clientName},</p><p>Your proposal ${proposal.title ?? proposal.proposal_number ?? ""} for ${project?.event_name ?? "your event"} is ready to review.</p><p><a href="${appUrl()}/client/proposals/${proposal.id}">Review your proposal</a></p>`,
    });
    emailStatus = result.status;
  }

  await logActivity(supabase, { actorId, projectId: proposal.project_id, action: "proposal_sent", entityType: "proposal", entityId: proposalId, metadata: { emailStatus } });
  return { success: true, message: emailStatus };
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
