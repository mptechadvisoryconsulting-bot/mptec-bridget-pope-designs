-- Proposal cancel/void + PDF import support for owner admin workflows.

alter table bpd_proposals drop constraint if exists bpd_proposals_status_check;
alter table bpd_proposals
  add constraint bpd_proposals_status_check
  check (status in ('draft','sent','viewed','approved','rejected','expired','cancelled'));

alter table bpd_proposals
  add column if not exists uploaded_pdf_path text,
  add column if not exists uploaded_pdf_original_name text,
  add column if not exists uploaded_pdf_uploaded_at timestamptz,
  add column if not exists sent_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bpd-proposal-uploads',
  'bpd-proposal-uploads',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins manage bpd proposal uploads" on storage.objects;
create policy "Admins manage bpd proposal uploads"
on storage.objects
for all
to authenticated
using (bucket_id = 'bpd-proposal-uploads' and bpd_is_admin())
with check (bucket_id = 'bpd-proposal-uploads' and bpd_is_admin());

drop policy if exists "Clients read own bpd proposal uploads" on storage.objects;
create policy "Clients read own bpd proposal uploads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bpd-proposal-uploads'
  and exists (
    select 1
    from bpd_proposals p
    join bpd_projects proj on proj.id = p.project_id
    where p.uploaded_pdf_path = name
      and bpd_can_access_project(proj.id)
  )
);
