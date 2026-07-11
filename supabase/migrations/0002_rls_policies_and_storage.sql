alter table bpd_profiles enable row level security;
alter table bpd_leads enable row level security;
alter table bpd_clients enable row level security;
alter table bpd_projects enable row level security;
alter table bpd_consultations enable row level security;
alter table bpd_proposals enable row level security;
alter table bpd_proposal_items enable row level security;
alter table bpd_contracts enable row level security;
alter table bpd_invoices enable row level security;
alter table bpd_invoice_items enable row level security;
alter table bpd_payments enable row level security;
alter table bpd_design_updates enable row level security;
alter table bpd_milestones enable row level security;
alter table bpd_tasks enable row level security;
alter table bpd_conversations enable row level security;
alter table bpd_messages enable row level security;
alter table bpd_files enable row level security;
alter table bpd_notifications enable row level security;
alter table bpd_event_reminders enable row level security;
alter table bpd_activity_logs enable row level security;
alter table bpd_automation_logs enable row level security;
alter table bpd_stripe_events enable row level security;
alter table bpd_business_settings enable row level security;

create or replace function bpd_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from bpd_profiles
    where bpd_profiles.auth_user_id = auth.uid()
      and bpd_profiles.role in ('owner', 'admin')
      and bpd_profiles.active = true
  );
$$;

create or replace function bpd_current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from bpd_profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function bpd_can_access_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select bpd_is_admin() or exists (
    select 1
    from bpd_projects
    join bpd_clients on bpd_clients.id = bpd_projects.client_id
    where bpd_projects.id = project_uuid
      and bpd_clients.profile_id = bpd_current_profile_id()
  );
$$;

create policy "Admins can manage bpd_profiles" on bpd_profiles for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Users can view their own profile" on bpd_profiles for select to authenticated using (auth_user_id = auth.uid());

create policy "Admins can manage bpd_leads" on bpd_leads for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

create policy "Admins can manage bpd_clients" on bpd_clients for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view own client record" on bpd_clients for select to authenticated using (profile_id = bpd_current_profile_id());

create policy "Admins can manage bpd_projects" on bpd_projects for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view own bpd_projects" on bpd_projects for select to authenticated using (bpd_can_access_project(id));

create policy "Admins can manage bpd_consultations" on bpd_consultations for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view project bpd_consultations" on bpd_consultations for select to authenticated using (project_id is not null and bpd_can_access_project(project_id));

create policy "Admins can manage bpd_proposals" on bpd_proposals for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view project bpd_proposals" on bpd_proposals for select to authenticated using (bpd_can_access_project(project_id));
create policy "Proposal items follow proposal access" on bpd_proposal_items for select to authenticated using (exists (select 1 from bpd_proposals where bpd_proposals.id = bpd_proposal_items.proposal_id and bpd_can_access_project(bpd_proposals.project_id)));

create policy "Admins can manage bpd_contracts" on bpd_contracts for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view project bpd_contracts" on bpd_contracts for select to authenticated using (bpd_can_access_project(project_id));

create policy "Admins can manage bpd_invoices" on bpd_invoices for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view own bpd_invoices" on bpd_invoices for select to authenticated using (bpd_can_access_project(project_id));
create policy "Invoice items follow invoice access" on bpd_invoice_items for select to authenticated using (exists (select 1 from bpd_invoices where bpd_invoices.id = bpd_invoice_items.invoice_id and bpd_can_access_project(bpd_invoices.project_id)));

create policy "Admins can manage bpd_payments" on bpd_payments for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view own bpd_payments" on bpd_payments for select to authenticated using (bpd_can_access_project(project_id));

create policy "Admins can manage design updates" on bpd_design_updates for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view visible design updates" on bpd_design_updates for select to authenticated using (client_visible = true and bpd_can_access_project(project_id));

create policy "Admins can manage bpd_milestones" on bpd_milestones for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view visible bpd_milestones" on bpd_milestones for select to authenticated using (client_visible = true and bpd_can_access_project(project_id));

create policy "Admins can manage bpd_tasks" on bpd_tasks for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

create policy "Admins can manage bpd_conversations" on bpd_conversations for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Clients can view own bpd_conversations" on bpd_conversations for select to authenticated using (bpd_can_access_project(project_id));

create policy "Admins can manage bpd_messages" on bpd_messages for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Participants can view bpd_messages" on bpd_messages for select to authenticated using (exists (select 1 from bpd_conversations where bpd_conversations.id = bpd_messages.conversation_id and bpd_can_access_project(bpd_conversations.project_id)));
create policy "Participants can insert bpd_messages" on bpd_messages for insert to authenticated with check (exists (select 1 from bpd_conversations where bpd_conversations.id = bpd_messages.conversation_id and bpd_can_access_project(bpd_conversations.project_id)));

create policy "Admins can manage bpd_files" on bpd_files for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Anyone can view public gallery bpd_files" on bpd_files for select to anon, authenticated using (visibility = 'public_gallery');
create policy "Clients can view visible project bpd_files" on bpd_files for select to authenticated using (visibility in ('client_visible','client_upload') and project_id is not null and bpd_can_access_project(project_id));

create policy "Users can view own bpd_notifications" on bpd_notifications for select to authenticated using (recipient_id = bpd_current_profile_id() or bpd_is_admin());
create policy "Users can update own bpd_notifications" on bpd_notifications for update to authenticated using (recipient_id = bpd_current_profile_id() or bpd_is_admin()) with check (recipient_id = bpd_current_profile_id() or bpd_is_admin());
create policy "Admins can insert bpd_notifications" on bpd_notifications for insert to authenticated with check (bpd_is_admin());

create policy "Admins can manage event reminders" on bpd_event_reminders for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Admins can view activity logs" on bpd_activity_logs for select to authenticated using (bpd_is_admin());
create policy "Admins can manage automation logs" on bpd_automation_logs for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());
create policy "Admins can view stripe events" on bpd_stripe_events for select to authenticated using (bpd_is_admin());
create policy "Admins can manage business settings" on bpd_business_settings for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bpd-event-gallery',
  'bpd-event-gallery',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bpd-inquiry-pdfs',
  'bpd-inquiry-pdfs',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
