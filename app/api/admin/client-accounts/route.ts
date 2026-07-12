import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeUsername, portalEmailForUsername } from "@/lib/auth/portal-credentials";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

const clientAccountSchema = z.object({
  username: z.string().min(4).max(40),
  password: z.string().min(8).max(100),
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  eventName: z.string().min(2).max(160),
  eventType: z.string().min(2).max(100),
  eventDate: z.string().optional().or(z.literal("")),
  venue: z.string().max(200).optional().or(z.literal("")),
  status: z.enum(["pending", "booked", "planning", "design_in_progress", "awaiting_client_approval", "finalizing", "ready_for_event", "event_complete"]).default("planning"),
});

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = clientAccountSchema.parse(await request.json());
  const username = normalizeUsername(input.username);
  const portalEmail = portalEmailForUsername(username);
  const supabase = createAdminClient();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingProfile) {
    return NextResponse.json({ success: false, message: "That username is already in use." }, { status: 409 });
  }

  const { data: userResult, error: userError } = await supabase.auth.admin.createUser({
    email: portalEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      username,
      first_name: input.firstName,
      last_name: input.lastName,
    },
  });

  if (userError || !userResult.user) {
    return NextResponse.json({ success: false, message: userError?.message ?? "Unable to create user." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: userResult.user.id,
      username,
      role: "client",
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email || portalEmail,
      phone: input.phone || null,
      active: true,
      portal_created_by: admin.profile.id,
      portal_created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ success: false, message: profileError?.message ?? "Unable to create profile." }, { status: 400 });
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({ profile_id: profile.id })
    .select("id")
    .single();

  if (clientError || !client) {
    return NextResponse.json({ success: false, message: clientError?.message ?? "Unable to create client." }, { status: 400 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      client_id: client.id,
      event_name: input.eventName,
      event_type: input.eventType,
      event_date: input.eventDate || null,
      venue_name: input.venue || null,
      status: input.status,
      assigned_admin_id: admin.profile.id,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    return NextResponse.json({ success: false, message: projectError?.message ?? "Unable to create project." }, { status: 400 });
  }

  await supabase.from("conversations").insert({ project_id: project.id, client_id: client.id });
  await supabase.from("notifications").insert({
    recipient_id: profile.id,
    project_id: project.id,
    type: "portal_created",
    title: "Your client portal is ready",
    message: "Your Bridget Pope Designs project workspace has been created.",
    action_url: "/client/dashboard",
  });

  return NextResponse.json(
    {
      success: true,
      username,
      authUserId: userResult.user.id,
      profileId: profile.id,
      clientId: client.id,
      projectId: project.id,
    },
    { status: 201 },
  );
}
