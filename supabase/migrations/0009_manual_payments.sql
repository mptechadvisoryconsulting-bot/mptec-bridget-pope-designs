-- Manual offline payments + private project-file storage bucket.

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'bpd_payments'
      and constraint_name = 'bpd_payments_payment_model_check'
  ) then
    alter table bpd_payments drop constraint bpd_payments_payment_model_check;
  end if;

  alter table bpd_payments
    add constraint bpd_payments_payment_model_check
    check (payment_model in ('destination_charge_v1', 'direct_charge_v2', 'manual'));
end $$;

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
