-- Remove HoneyBook external billing integration; restore internal invoice/proposal workflow.
-- Safe on localhost and production: drops HoneyBook-only tables, renames pipeline stage,
-- and adds uploaded invoice PDF support.
--
-- Optional one-time seed (run manually if needed):
--   update bpd_business_settings
--   set inquiry_recipient_email = 'bpeventsanddesigns@gmail.com',
--       business_email = 'bpeventsanddesigns@gmail.com'
--   where id is not null;

-- 1) Drop HoneyBook financial reference table + policies
drop policy if exists "Admins can manage bpd_honeybook_financial_references" on bpd_honeybook_financial_references;
drop policy if exists "Clients can view own bpd_honeybook_financial_references" on bpd_honeybook_financial_references;
drop table if exists bpd_honeybook_financial_references cascade;

-- 2) Drop projects.honeybook_url
alter table bpd_projects drop column if exists honeybook_url;

-- 3) Rename pipeline stage honeybook_opened → proposal_workspace
update bpd_projects
set pipeline_stage = 'proposal_workspace'
where pipeline_stage = 'honeybook_opened';

update bpd_pipeline_events
set stage = 'proposal_workspace'
where stage = 'honeybook_opened';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'bpd_projects'
      and constraint_name = 'bpd_projects_pipeline_stage_check'
  ) then
    alter table bpd_projects drop constraint bpd_projects_pipeline_stage_check;
  end if;

  alter table bpd_projects
    add constraint bpd_projects_pipeline_stage_check
    check (pipeline_stage in (
      'lead_received',
      'consultation',
      'proposal_draft',
      'proposal_workspace',
      'proposal_sent',
      'proposal_approved',
      'project_started',
      'invoice_paid',
      'completed'
    ));
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'bpd_pipeline_events'
      and constraint_name = 'bpd_pipeline_events_stage_check'
  ) then
    alter table bpd_pipeline_events drop constraint bpd_pipeline_events_stage_check;
  end if;

  alter table bpd_pipeline_events
    add constraint bpd_pipeline_events_stage_check
    check (stage in (
      'lead_received',
      'consultation',
      'proposal_draft',
      'proposal_workspace',
      'proposal_sent',
      'proposal_approved',
      'project_started',
      'invoice_paid',
      'completed'
    ));
end $$;

-- Prefer system/manual sources going forward (keep honeybook_api for historical rows if present)
do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'bpd_pipeline_events'
      and constraint_name = 'bpd_pipeline_events_source_check'
  ) then
    alter table bpd_pipeline_events drop constraint bpd_pipeline_events_source_check;
  end if;

  alter table bpd_pipeline_events
    add constraint bpd_pipeline_events_source_check
    check (source in ('manual', 'system', 'honeybook_api'));
end $$;

-- 4) Relax design update client_action_type away from honeybook_action (map existing rows)
update bpd_design_updates
set client_action_type = 'general'
where client_action_type = 'honeybook_action';

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'bpd_design_updates'
      and constraint_name = 'bpd_design_updates_client_action_type_check'
  ) then
    alter table bpd_design_updates drop constraint bpd_design_updates_client_action_type_check;
  end if;

  alter table bpd_design_updates
    add constraint bpd_design_updates_client_action_type_check
    check (client_action_type in (
      'not_required',
      'design_approval',
      'design_feedback',
      'information_requested',
      'file_requested',
      'general'
    ));
end $$;

-- 5) Uploaded invoice PDF support
alter table bpd_invoices
  add column if not exists uploaded_pdf_path text,
  add column if not exists uploaded_pdf_original_name text,
  add column if not exists uploaded_pdf_uploaded_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bpd-invoice-uploads',
  'bpd-invoice-uploads',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can manage bpd invoice uploads" on storage.objects;
create policy "Admins can manage bpd invoice uploads"
on storage.objects
for all
to authenticated
using (bucket_id = 'bpd-invoice-uploads' and bpd_is_admin())
with check (bucket_id = 'bpd-invoice-uploads' and bpd_is_admin());

drop policy if exists "Clients can read own bpd invoice uploads" on storage.objects;
create policy "Clients can read own bpd invoice uploads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bpd-invoice-uploads'
  and exists (
    select 1
    from bpd_invoices i
    join bpd_clients c on c.id = i.client_id
    where i.uploaded_pdf_path = name
      and c.profile_id = bpd_current_profile_id()
  )
);

-- 6) Default inquiry/business email for the single settings row when blank
update bpd_business_settings
set
  inquiry_recipient_email = coalesce(nullif(trim(inquiry_recipient_email), ''), 'bpeventsanddesigns@gmail.com'),
  business_email = coalesce(nullif(trim(business_email), ''), 'bpeventsanddesigns@gmail.com')
where id is not null;
