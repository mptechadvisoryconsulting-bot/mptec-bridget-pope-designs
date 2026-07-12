alter table bpd_business_settings
  add column if not exists stripe_connected_account_id text,
  add column if not exists stripe_payment_model text not null default 'destination_charges',
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists stripe_details_submitted boolean not null default false,
  add column if not exists stripe_requirements_currently_due text[] not null default '{}'::text[],
  add column if not exists stripe_requirements_disabled_reason text,
  add column if not exists stripe_account_last_synced_at timestamptz,
  add column if not exists email_last_test_sent_at timestamptz,
  add column if not exists email_last_error text;

alter table bpd_invoices
  add column if not exists template_id uuid,
  add column if not exists template_snapshot jsonb,
  add column if not exists template_overrides jsonb not null default '{}'::jsonb,
  add column if not exists active_version integer not null default 1,
  add column if not exists checkout_status text;

alter table bpd_stripe_events
  add column if not exists processing_started_at timestamptz,
  add column if not exists processing_error text;

create table if not exists bpd_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_invoice_template_assets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references bpd_invoice_templates(id) on delete cascade,
  file_id uuid references bpd_files(id),
  asset_type text not null default 'logo',
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_name = 'bpd_invoices'
      and constraint_name = 'bpd_invoices_template_fk'
  ) then
    alter table bpd_invoices
      add constraint bpd_invoices_template_fk
      foreign key (template_id) references bpd_invoice_templates(id);
  end if;
end $$;

create table if not exists bpd_invoice_versions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references bpd_invoices(id) on delete cascade,
  version_number integer not null,
  template_id uuid references bpd_invoice_templates(id),
  template_snapshot jsonb not null,
  invoice_snapshot jsonb not null,
  status text not null default 'active',
  pdf_url text,
  created_by uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  unique(invoice_id, version_number)
);

create unique index if not exists bpd_invoice_templates_single_default
  on bpd_invoice_templates ((is_default))
  where is_default;

create index if not exists bpd_idx_invoice_templates_default on bpd_invoice_templates(is_default);
create index if not exists bpd_idx_invoice_versions_invoice_id on bpd_invoice_versions(invoice_id);
create index if not exists bpd_idx_business_settings_stripe_account on bpd_business_settings(stripe_connected_account_id);

insert into bpd_invoice_templates (name, is_default, config)
select
  'Luxury Event Invoice',
  true,
  '{
    "businessName": "Bridget Pope Designs",
    "accentColor": "#c96f82",
    "paymentTerms": "Payment is due within 15 days unless another schedule is listed on the invoice.",
    "footerNote": "Thank you for trusting Bridget Pope Designs with your celebration.",
    "paymentModel": "destination_charges"
  }'::jsonb
where not exists (select 1 from bpd_invoice_templates where is_default = true);

alter table bpd_invoice_templates enable row level security;
alter table bpd_invoice_template_assets enable row level security;
alter table bpd_invoice_versions enable row level security;

drop policy if exists "Admins can manage bpd_invoice_templates" on bpd_invoice_templates;
create policy "Admins can manage bpd_invoice_templates"
on bpd_invoice_templates
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Admins can manage bpd_invoice_template_assets" on bpd_invoice_template_assets;
create policy "Admins can manage bpd_invoice_template_assets"
on bpd_invoice_template_assets
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Admins can manage bpd_invoice_versions" on bpd_invoice_versions;
create policy "Admins can manage bpd_invoice_versions"
on bpd_invoice_versions
for all
to authenticated
using (bpd_is_admin())
with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_invoice_versions" on bpd_invoice_versions;
create policy "Clients can view own bpd_invoice_versions"
on bpd_invoice_versions
for select
to authenticated
using (
  exists (
    select 1
    from bpd_invoices i
    join bpd_clients c on c.id = i.client_id
    where i.id = bpd_invoice_versions.invoice_id
      and c.profile_id = bpd_current_profile_id()
  )
);
