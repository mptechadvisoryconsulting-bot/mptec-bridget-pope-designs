-- HoneyBook project workflow refactor.
-- Additive only: legacy invoice/payment/proposal/contract tables remain for historical data.

create table if not exists bpd_honeybook_financial_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id) on delete cascade,
  client_id uuid not null references bpd_clients(id) on delete cascade,
  honeybook_project_id text,
  honeybook_invoice_number text,
  invoice_total numeric(12,2),
  amount_paid numeric(12,2),
  balance_remaining numeric(12,2),
  invoice_status text,
  invoice_date date,
  due_date date,
  honeybook_url text,
  source text not null default 'manual' check (source in ('manual','pdf_import','csv_import','automation')),
  review_status text not null default 'confirmed' check (review_status in ('needs_review','confirmed','archived')),
  source_file_id uuid references bpd_files(id) on delete set null,
  imported_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists bpd_idx_honeybook_refs_project
  on bpd_honeybook_financial_references(project_id);

create index if not exists bpd_idx_honeybook_refs_client
  on bpd_honeybook_financial_references(client_id);

create index if not exists bpd_idx_honeybook_refs_hb_project
  on bpd_honeybook_financial_references(honeybook_project_id)
  where honeybook_project_id is not null;

alter table bpd_honeybook_financial_references enable row level security;

drop policy if exists "Admins can manage bpd_honeybook_financial_references" on bpd_honeybook_financial_references;
create policy "Admins can manage bpd_honeybook_financial_references"
on bpd_honeybook_financial_references
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_honeybook_financial_references" on bpd_honeybook_financial_references;
create policy "Clients can view own bpd_honeybook_financial_references"
on bpd_honeybook_financial_references
for select
to authenticated
using (bpd_can_access_project(project_id));

alter table bpd_design_updates
  add column if not exists requires_client_action boolean not null default false,
  add column if not exists client_action_type text not null default 'not_required',
  add column if not exists client_action_status text not null default 'not_required',
  add column if not exists client_action_due_date date,
  add column if not exists client_response text,
  add column if not exists client_responded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_design_updates'
      and constraint_name = 'bpd_design_updates_client_action_type_check'
  ) then
    alter table bpd_design_updates
      add constraint bpd_design_updates_client_action_type_check
      check (client_action_type in ('not_required','design_approval','design_feedback','information_requested','file_requested','honeybook_action','general'));
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_design_updates'
      and constraint_name = 'bpd_design_updates_client_action_status_check'
  ) then
    alter table bpd_design_updates
      add constraint bpd_design_updates_client_action_status_check
      check (client_action_status in ('not_required','pending','completed','overdue'));
  end if;
end $$;

create table if not exists bpd_design_versions (
  id uuid primary key default gen_random_uuid(),
  design_update_id uuid not null references bpd_design_updates(id) on delete cascade,
  project_id uuid not null references bpd_projects(id) on delete cascade,
  version_number integer not null,
  title text,
  description text,
  created_by uuid references bpd_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(design_update_id, version_number)
);

create index if not exists bpd_idx_design_versions_project
  on bpd_design_versions(project_id);

create table if not exists bpd_design_feedback (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null references bpd_design_versions(id) on delete cascade,
  project_id uuid not null references bpd_projects(id) on delete cascade,
  client_id uuid not null references bpd_clients(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists bpd_idx_design_feedback_project
  on bpd_design_feedback(project_id);

create table if not exists bpd_design_approvals (
  id uuid primary key default gen_random_uuid(),
  design_version_id uuid not null references bpd_design_versions(id) on delete cascade,
  project_id uuid not null references bpd_projects(id) on delete cascade,
  client_id uuid not null references bpd_clients(id) on delete cascade,
  approved_at timestamptz not null default now(),
  unique(design_version_id, client_id)
);

create index if not exists bpd_idx_design_approvals_project
  on bpd_design_approvals(project_id);

alter table bpd_design_versions enable row level security;
alter table bpd_design_feedback enable row level security;
alter table bpd_design_approvals enable row level security;

drop policy if exists "Admins can manage bpd_design_versions" on bpd_design_versions;
create policy "Admins can manage bpd_design_versions"
on bpd_design_versions
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_design_versions" on bpd_design_versions;
create policy "Clients can view own bpd_design_versions"
on bpd_design_versions
for select
to authenticated
using (bpd_can_access_project(project_id));

drop policy if exists "Admins can manage bpd_design_feedback" on bpd_design_feedback;
create policy "Admins can manage bpd_design_feedback"
on bpd_design_feedback
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Clients can create own bpd_design_feedback" on bpd_design_feedback;
create policy "Clients can create own bpd_design_feedback"
on bpd_design_feedback
for insert
to authenticated
with check (bpd_can_access_project(project_id));

drop policy if exists "Clients can view own bpd_design_feedback" on bpd_design_feedback;
create policy "Clients can view own bpd_design_feedback"
on bpd_design_feedback
for select
to authenticated
using (bpd_can_access_project(project_id));

drop policy if exists "Admins can manage bpd_design_approvals" on bpd_design_approvals;
create policy "Admins can manage bpd_design_approvals"
on bpd_design_approvals
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Clients can create own bpd_design_approvals" on bpd_design_approvals;
create policy "Clients can create own bpd_design_approvals"
on bpd_design_approvals
for insert
to authenticated
with check (bpd_can_access_project(project_id));

drop policy if exists "Clients can view own bpd_design_approvals" on bpd_design_approvals;
create policy "Clients can view own bpd_design_approvals"
on bpd_design_approvals
for select
to authenticated
using (bpd_can_access_project(project_id));

alter table bpd_profiles
  add column if not exists last_portal_login_at timestamptz;

alter table bpd_clients
  add column if not exists last_message_at timestamptz,
  add column if not exists latest_design_viewed_at timestamptz,
  add column if not exists latest_notification_read_at timestamptz;
