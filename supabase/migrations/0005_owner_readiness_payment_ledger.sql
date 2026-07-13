alter table bpd_business_settings
  add column if not exists business_display_name text not null default 'Bridget Pope Designs',
  add column if not exists inquiry_recipient_email text,
  add column if not exists invoice_from_display_name text not null default 'Bridget Pope Designs',
  add column if not exists invoice_reply_to text,
  add column if not exists owner_message_notification_email text,
  add column if not exists client_email_notifications_enabled boolean not null default true,
  add column if not exists inquiry_notifications_enabled boolean not null default true,
  add column if not exists invoice_notifications_enabled boolean not null default true,
  add column if not exists payment_confirmation_notifications_enabled boolean not null default true,
  add column if not exists email_provider_last_success_at timestamptz,
  add column if not exists email_provider_last_message_id text,
  add column if not exists email_provider_last_failure_at timestamptz,
  add column if not exists email_provider_last_error text,
  add column if not exists email_readiness_status text not null default 'not_configured',
  add column if not exists payment_readiness_status text not null default 'not_connected',
  add column if not exists platform_fee_basis_points integer not null default 100;

update bpd_business_settings
set
  inquiry_recipient_email = coalesce(inquiry_recipient_email, business_email),
  owner_message_notification_email = coalesce(owner_message_notification_email, business_email),
  invoice_reply_to = coalesce(invoice_reply_to, business_email),
  email_readiness_status = case
    when coalesce(inquiry_recipient_email, business_email) is null then 'not_configured'
    when email_last_error is not null then 'failed'
    else 'ready'
  end,
  email_provider_last_failure_at = case when email_last_error is not null then coalesce(email_provider_last_failure_at, now()) else email_provider_last_failure_at end,
  email_provider_last_error = coalesce(email_provider_last_error, email_last_error);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_business_settings'
      and constraint_name = 'bpd_business_settings_platform_fee_basis_points_check'
  ) then
    alter table bpd_business_settings
      add constraint bpd_business_settings_platform_fee_basis_points_check
      check (platform_fee_basis_points >= 0 and platform_fee_basis_points <= 10000);
  end if;
end $$;

alter table bpd_invoices
  add column if not exists sent_at timestamptz,
  add column if not exists viewed_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists last_payment_attempt_at timestamptz,
  add column if not exists last_payment_failure_message text;

alter table bpd_invoice_templates
  add column if not exists archived_at timestamptz,
  add column if not exists version_number integer not null default 1;

update bpd_invoice_templates
set config = config || '{
  "invoiceTitle": "Invoice",
  "secondaryColor": "#d9af6f",
  "backgroundOpacity": 0.06,
  "billToLabel": "Bill To",
  "invoiceNumberLabel": "Invoice #",
  "invoiceDateLabel": "Invoice Date",
  "dueDateLabel": "Due Date",
  "subtotalLabel": "Subtotal",
  "discountLabel": "Discount",
  "taxLabel": "Tax",
  "amountPaidLabel": "Amount Paid",
  "balanceDueLabel": "Balance Due",
  "totalLabel": "Total"
}'::jsonb
where is_default = true;

alter table bpd_invoices drop constraint if exists bpd_invoices_status_check;
alter table bpd_invoices
  add constraint bpd_invoices_status_check
  check (status in ('draft','sent','viewed','pending','processing','partially_paid','paid','failed','payment_failed','overdue','cancelled','refunded','partially_refunded'));

alter table bpd_payments
  add column if not exists gross_amount numeric(12,2),
  add column if not exists platform_fee_amount numeric(12,2) not null default 0,
  add column if not exists stripe_processing_fee numeric(12,2),
  add column if not exists net_amount numeric(12,2),
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists stripe_application_fee_id text,
  add column if not exists stripe_balance_transaction_id text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update bpd_payments
set gross_amount = coalesce(gross_amount, amount)
where gross_amount is null;

create unique index if not exists bpd_payments_unique_checkout_session
  on bpd_payments(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists bpd_payments_unique_paid_payment_intent
  on bpd_payments(stripe_payment_intent_id)
  where stripe_payment_intent_id is not null and status = 'paid';

create table if not exists bpd_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references bpd_invoices(id),
  project_id uuid references bpd_projects(id),
  client_id uuid references bpd_clients(id),
  stripe_event_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'usd',
  status text not null,
  failure_code text,
  failure_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists bpd_payment_adjustments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references bpd_payments(id),
  invoice_id uuid references bpd_invoices(id),
  project_id uuid references bpd_projects(id),
  client_id uuid references bpd_clients(id),
  stripe_event_id text,
  stripe_refund_id text,
  stripe_dispute_id text,
  stripe_payout_id text,
  adjustment_type text not null check (adjustment_type in ('refund','dispute','payout_failure','fee_update')),
  amount numeric(12,2) not null default 0,
  currency text not null default 'usd',
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists bpd_payment_attempts_unique_stripe_event
  on bpd_payment_attempts(stripe_event_id)
  where stripe_event_id is not null;

create unique index if not exists bpd_payment_adjustments_unique_refund
  on bpd_payment_adjustments(stripe_refund_id)
  where stripe_refund_id is not null;

create unique index if not exists bpd_payment_adjustments_unique_dispute
  on bpd_payment_adjustments(stripe_dispute_id)
  where stripe_dispute_id is not null;

create unique index if not exists bpd_payment_adjustments_unique_payout_failure
  on bpd_payment_adjustments(stripe_payout_id, adjustment_type)
  where stripe_payout_id is not null and adjustment_type = 'payout_failure';

alter table bpd_stripe_events
  add column if not exists processing_status text not null default 'claimed',
  add column if not exists claimed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists retry_count integer not null default 0;

update bpd_stripe_events
set
  processing_status = case
    when processed_at is not null then 'processed'
    when processing_error is not null then 'failed'
    else processing_status
  end,
  claimed_at = coalesce(claimed_at, processing_started_at, created_at),
  failed_at = case when processing_error is not null then coalesce(failed_at, now()) else failed_at end;

alter table bpd_payment_attempts enable row level security;
alter table bpd_payment_adjustments enable row level security;

drop policy if exists "Admins can manage bpd_payment_attempts" on bpd_payment_attempts;
create policy "Admins can manage bpd_payment_attempts"
on bpd_payment_attempts
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Admins can manage bpd_payment_adjustments" on bpd_payment_adjustments;
create policy "Admins can manage bpd_payment_adjustments"
on bpd_payment_adjustments
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_payment_attempts" on bpd_payment_attempts;
create policy "Clients can view own bpd_payment_attempts"
on bpd_payment_attempts
for select
to authenticated
using (
  exists (
    select 1
    from bpd_clients c
    where c.id = bpd_payment_attempts.client_id
      and c.profile_id = bpd_current_profile_id()
  )
);

drop policy if exists "Clients can view own bpd_payment_adjustments" on bpd_payment_adjustments;
create policy "Clients can view own bpd_payment_adjustments"
on bpd_payment_adjustments
for select
to authenticated
using (
  exists (
    select 1
    from bpd_clients c
    where c.id = bpd_payment_adjustments.client_id
      and c.profile_id = bpd_current_profile_id()
  )
);
