-- Stripe Connect direct-charge support for Bridget Pope Designs.
-- Additive only: existing manual/offline payments remain unchanged.
-- Production already contains the original Stripe event table, so preserve it and extend it.
-- Application code uses lib/supabase/namespace.ts, which maps logical
-- `stripe_events` / `payment_adjustments` access to these bpd_-prefixed tables.

alter table bpd_business_settings
  add column if not exists payment_readiness_status text not null default 'not_configured',
  add column if not exists platform_fee_basis_points integer not null default 100;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bpd_business_settings_platform_fee_site_range_check'
  ) then
    alter table bpd_business_settings
      add constraint bpd_business_settings_platform_fee_site_range_check
      check (platform_fee_basis_points between 100 and 300);
  end if;
end $$;

create table if not exists bpd_stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processing_error text,
  processing_status text not null default 'claimed',
  claimed_at timestamptz,
  failed_at timestamptz,
  retry_count integer not null default 0
);

alter table bpd_stripe_events
  add column if not exists stripe_account_id text,
  add column if not exists object_id text;

create table if not exists bpd_payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references bpd_payments(id) on delete cascade,
  invoice_id uuid not null references bpd_invoices(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('refund')),
  amount numeric(12,2) not null check (amount >= 0),
  status text not null default 'succeeded',
  stripe_event_id text unique,
  stripe_refund_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists bpd_payments_stripe_event_id_unique
  on bpd_payments(stripe_event_id)
  where stripe_event_id is not null;

create unique index if not exists bpd_payments_stripe_checkout_session_id_unique
  on bpd_payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists bpd_payments_stripe_payment_intent_id_unique
  on bpd_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create index if not exists bpd_idx_stripe_events_account_created
  on bpd_stripe_events(stripe_account_id, created_at desc);

create index if not exists bpd_idx_payment_adjustments_payment
  on bpd_payment_adjustments(payment_id, created_at desc);

create unique index if not exists bpd_payment_adjustments_one_refund_state_per_payment
  on bpd_payment_adjustments(payment_id)
  where adjustment_type = 'refund';

alter table bpd_stripe_events enable row level security;
alter table bpd_payment_adjustments enable row level security;

drop policy if exists "Admins can view bpd_stripe_events" on bpd_stripe_events;
create policy "Admins can view bpd_stripe_events"
on bpd_stripe_events
for select
to authenticated
using (bpd_is_admin());

drop policy if exists "Admins can manage bpd_payment_adjustments" on bpd_payment_adjustments;
create policy "Admins can manage bpd_payment_adjustments"
on bpd_payment_adjustments
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

-- Preserve the current fee percentage; only enforce the intended direct-charge model.
update bpd_business_settings
set stripe_payment_model = 'direct_charge_v2'
where stripe_payment_model is distinct from 'direct_charge_v2';
