-- Phase 11: manual invoice tracking after Stripe removal.
-- Do NOT drop legacy Stripe columns/tables yet. Candidates for a later migration:
--   bpd_clients.stripe_customer_id
--   bpd_invoices.stripe_payment_link_id, stripe_payment_link_url, stripe_checkout_session_id
--   bpd_payments.stripe_* columns
--   bpd_payment_attempts / bpd_stripe_events tables
--   bpd_business_settings.stripe_account_mode and related Stripe readiness fields

-- Expand invoice status check for draft/sent/manual offline workflow + keep legacy statuses.
alter table bpd_invoices drop constraint if exists bpd_invoices_status_check;
alter table bpd_invoices
  add constraint bpd_invoices_status_check
  check (status in (
    'draft',
    'sent',
    'viewed',
    'payment_arrangement',
    'partially_paid',
    'paid',
    'overdue',
    'void',
    'cancelled',
    -- legacy / historical Stripe-era statuses
    'pending',
    'processing',
    'failed',
    'payment_failed',
    'refunded',
    'partially_refunded'
  ));

alter table bpd_invoices
  alter column status set default 'draft';

-- Active project pointer for client portal selection.
alter table bpd_clients
  add column if not exists active_project_id uuid references bpd_projects(id);

create index if not exists bpd_idx_clients_active_project_id
  on bpd_clients(active_project_id);

-- Idempotent lead conversion: one project per lead when lead_id is present.
create unique index if not exists bpd_projects_lead_id_unique
  on bpd_projects(lead_id)
  where lead_id is not null;

-- Case-insensitive unique email for client profiles when safe.
-- Skipped as a hard unique across all roles if duplicate emails already exist;
-- use a partial unique on active client emails only when no collisions.
do $$
begin
  if not exists (
    select 1
    from bpd_profiles
    where role = 'client'
      and email is not null
    group by lower(email)
    having count(*) > 1
  ) then
    execute $idx$
      create unique index if not exists bpd_profiles_client_email_lower_unique
        on bpd_profiles (lower(email))
        where role = 'client' and email is not null
    $idx$;
  else
    raise notice 'Skipping bpd_profiles_client_email_lower_unique because duplicate client emails already exist';
  end if;
end $$;

-- Client invoice select policy: hide drafts and unsent invoices.
drop policy if exists "Clients can view own bpd_invoices" on bpd_invoices;
create policy "Clients can view own bpd_invoices" on bpd_invoices
  for select
  to authenticated
  using (
    bpd_can_access_project(project_id)
    and status <> 'draft'
    and sent_at is not null
  );

-- Invoice items follow the same visibility rules via parent invoice access.
drop policy if exists "Invoice items follow invoice access" on bpd_invoice_items;
create policy "Invoice items follow invoice access" on bpd_invoice_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from bpd_invoices
      where bpd_invoices.id = bpd_invoice_items.invoice_id
        and bpd_can_access_project(bpd_invoices.project_id)
        and (
          bpd_is_admin()
          or (bpd_invoices.status <> 'draft' and bpd_invoices.sent_at is not null)
        )
    )
  );
