alter table bpd_business_settings
  add column if not exists stripe_connect_provisioning_status text not null default 'not_started',
  add column if not exists stripe_connect_provisioning_key text,
  add column if not exists stripe_connect_provisioning_started_at timestamptz,
  add column if not exists stripe_connect_provisioning_error text,
  add column if not exists stripe_connect_provisioned_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_business_settings'
      and constraint_name = 'bpd_business_settings_stripe_connect_provisioning_status_check'
  ) then
    alter table bpd_business_settings
      add constraint bpd_business_settings_stripe_connect_provisioning_status_check
      check (stripe_connect_provisioning_status in ('not_started','provisioning','account_created','onboarding_required','ready','failed'));
  end if;
end $$;

alter table bpd_payment_attempts
  add column if not exists profile_id uuid references bpd_profiles(id),
  add column if not exists requested_amount numeric(12,2),
  add column if not exists idempotency_key text,
  add column if not exists expires_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update bpd_payment_attempts
set requested_amount = coalesce(requested_amount, amount)
where requested_amount is null;

create unique index if not exists bpd_payment_attempts_unique_idempotency_key
  on bpd_payment_attempts(idempotency_key)
  where idempotency_key is not null;

create index if not exists bpd_idx_payment_attempts_invoice_status
  on bpd_payment_attempts(invoice_id, status);

create index if not exists bpd_idx_business_settings_connect_provisioning
  on bpd_business_settings(stripe_connect_provisioning_status, stripe_connect_provisioning_key);
