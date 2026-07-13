insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bpd-invoice-template-assets',
  'bpd-invoice-template-assets',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
