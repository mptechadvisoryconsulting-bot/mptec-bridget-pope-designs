-- Project-file storage bucket used by client and admin project workspaces.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bpd-project-files',
  'bpd-project-files',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
