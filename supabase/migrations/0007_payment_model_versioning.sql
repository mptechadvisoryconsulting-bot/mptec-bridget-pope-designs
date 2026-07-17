alter table bpd_payment_attempts
  add column if not exists payment_model text,
  add column if not exists stripe_account_context text;

alter table bpd_payments
  add column if not exists payment_model text,
  add column if not exists stripe_account_context text;

update bpd_payment_attempts
set
  payment_model = coalesce(payment_model, 'destination_charge_v1'),
  stripe_account_context = coalesce(stripe_account_context, metadata->>'stripe_account_id')
where payment_model is null or stripe_account_context is null;

update bpd_payments
set
  payment_model = coalesce(payment_model, 'destination_charge_v1'),
  stripe_account_context = coalesce(stripe_account_context, stripe_connected_account_id)
where payment_model is null or stripe_account_context is null;

alter table bpd_payment_attempts
  alter column payment_model set default 'destination_charge_v1',
  alter column payment_model set not null;

alter table bpd_payments
  alter column payment_model set default 'destination_charge_v1',
  alter column payment_model set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_payment_attempts'
      and constraint_name = 'bpd_payment_attempts_payment_model_check'
  ) then
    alter table bpd_payment_attempts
      add constraint bpd_payment_attempts_payment_model_check
      check (payment_model in ('destination_charge_v1','direct_charge_v2'));
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_payments'
      and constraint_name = 'bpd_payments_payment_model_check'
  ) then
    alter table bpd_payments
      add constraint bpd_payments_payment_model_check
      check (payment_model in ('destination_charge_v1','direct_charge_v2'));
  end if;
end $$;

create index if not exists bpd_idx_payment_attempts_model_context
  on bpd_payment_attempts(payment_model, stripe_account_context);

create index if not exists bpd_idx_payments_model_context
  on bpd_payments(payment_model, stripe_account_context);
