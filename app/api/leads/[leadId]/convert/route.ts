import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ leadId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { leadId } = await params;
  const supabase = createAdminClient();
  const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", leadId).single();
  if (leadError || !lead) return NextResponse.json({ success: false, message: "Lead not found" }, { status: 404 });

  const { data: existingClient } = await supabase.from("clients").select("id").eq("lead_id", leadId).maybeSingle();
  if (existingClient) {
    return NextResponse.json({ success: true, idempotent: true, clientId: existingClient.id });
  }

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
    .select()
    .single();
  if (profileError || !profile) throw new Error(profileError?.message ?? "Unable to create profile");

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({ profile_id: profile.id, lead_id: lead.id })
    .select()
    .single();
  if (clientError || !client) throw new Error(clientError?.message ?? "Unable to create client");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_id: client.id,
      lead_id: lead.id,
      event_name: `${lead.event_type} for ${lead.first_name} ${lead.last_name}`,
      event_type: lead.event_type,
      event_date: lead.event_date,
      venue_name: lead.venue,
      city: lead.city,
      guest_count: lead.guest_count,
      budget: lead.estimated_budget,
      color_palette: lead.event_colors,
      theme: lead.event_theme,
      status: "planning",
      assigned_admin_id: lead.assigned_admin_id ?? admin.profile.id,
    })
    .select()
    .single();
  if (projectError || !project) throw new Error(projectError?.message ?? "Unable to create project");

  await supabase.from("conversations").insert({ project_id: project.id, client_id: client.id });
  await supabase.from("leads").update({ status: "converted" }).eq("id", lead.id);
  await supabase.from("activity_logs").insert({
    lead_id: lead.id,
    project_id: project.id,
    action: "lead_converted",
    entity_type: "lead",
    entity_id: lead.id,
  });

  return NextResponse.json({ success: true, clientId: client.id, projectId: project.id });
}
