alter table profiles enable row level security;
alter table leads enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
alter table consultations enable row level security;
alter table proposals enable row level security;
alter table proposal_items enable row level security;
alter table contracts enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table design_updates enable row level security;
alter table milestones enable row level security;
alter table tasks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table files enable row level security;
alter table notifications enable row level security;
alter table event_reminders enable row level security;
alter table activity_logs enable row level security;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where profiles.auth_user_id = auth.uid()
      and profiles.role in ('owner', 'admin')
      and profiles.active = true
  );
$$;

create or replace function current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function can_access_project(project_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin() or exists (
    select 1
    from projects
    join clients on clients.id = projects.client_id
    where projects.id = project_uuid
      and clients.profile_id = current_profile_id()
  );
$$;

create policy "Admins can manage profiles" on profiles for all to authenticated using (is_admin()) with check (is_admin());
create policy "Users can view their own profile" on profiles for select to authenticated using (auth_user_id = auth.uid());

create policy "Admins can manage leads" on leads for all to authenticated using (is_admin()) with check (is_admin());

create policy "Admins can manage clients" on clients for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view own client record" on clients for select to authenticated using (profile_id = current_profile_id());

create policy "Admins can manage projects" on projects for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view own projects" on projects for select to authenticated using (can_access_project(id));

create policy "Admins can manage consultations" on consultations for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view project consultations" on consultations for select to authenticated using (project_id is not null and can_access_project(project_id));

create policy "Admins can manage proposals" on proposals for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view project proposals" on proposals for select to authenticated using (can_access_project(project_id));
create policy "Proposal items follow proposal access" on proposal_items for select to authenticated using (exists (select 1 from proposals where proposals.id = proposal_items.proposal_id and can_access_project(proposals.project_id)));

create policy "Admins can manage contracts" on contracts for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view project contracts" on contracts for select to authenticated using (can_access_project(project_id));

create policy "Admins can manage invoices" on invoices for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view own invoices" on invoices for select to authenticated using (can_access_project(project_id));
create policy "Invoice items follow invoice access" on invoice_items for select to authenticated using (exists (select 1 from invoices where invoices.id = invoice_items.invoice_id and can_access_project(invoices.project_id)));

create policy "Admins can manage payments" on payments for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view own payments" on payments for select to authenticated using (can_access_project(project_id));

create policy "Admins can manage design updates" on design_updates for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view visible design updates" on design_updates for select to authenticated using (client_visible = true and can_access_project(project_id));

create policy "Admins can manage milestones" on milestones for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view visible milestones" on milestones for select to authenticated using (client_visible = true and can_access_project(project_id));

create policy "Admins can manage tasks" on tasks for all to authenticated using (is_admin()) with check (is_admin());

create policy "Admins can manage conversations" on conversations for all to authenticated using (is_admin()) with check (is_admin());
create policy "Clients can view own conversations" on conversations for select to authenticated using (can_access_project(project_id));

create policy "Admins can manage messages" on messages for all to authenticated using (is_admin()) with check (is_admin());
create policy "Participants can view messages" on messages for select to authenticated using (exists (select 1 from conversations where conversations.id = messages.conversation_id and can_access_project(conversations.project_id)));
create policy "Participants can insert messages" on messages for insert to authenticated with check (exists (select 1 from conversations where conversations.id = messages.conversation_id and can_access_project(conversations.project_id)));

create policy "Admins can manage files" on files for all to authenticated using (is_admin()) with check (is_admin());
create policy "Anyone can view public gallery files" on files for select to anon, authenticated using (visibility = 'public_gallery');
create policy "Clients can view visible project files" on files for select to authenticated using (visibility in ('client_visible','client_upload') and project_id is not null and can_access_project(project_id));

create policy "Users can view own notifications" on notifications for select to authenticated using (recipient_id = current_profile_id() or is_admin());
create policy "Users can update own notifications" on notifications for update to authenticated using (recipient_id = current_profile_id() or is_admin()) with check (recipient_id = current_profile_id() or is_admin());
create policy "Admins can insert notifications" on notifications for insert to authenticated with check (is_admin());

create policy "Admins can manage event reminders" on event_reminders for all to authenticated using (is_admin()) with check (is_admin());
create policy "Admins can view activity logs" on activity_logs for select to authenticated using (is_admin());
