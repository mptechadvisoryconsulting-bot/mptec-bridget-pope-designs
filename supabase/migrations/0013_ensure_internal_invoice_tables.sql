-- Ensure internal invoice/payment tables exist (production was missing base billing tables).
-- Idempotent: safe when 0001/0004/0010/0012 already applied.

create table if not exists bpd_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  client_id uuid not null references bpd_clients(id),
  proposal_id uuid references bpd_proposals(id),
  invoice_number text unique not null,
  invoice_type text not null check (invoice_type in ('deposit','installment','final','custom')),
  description text,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  due_date date,
  status text not null default 'draft',
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_checkout_session_id text,
  template_id uuid references bpd_invoice_templates(id),
  template_snapshot jsonb,
  template_overrides jsonb not null default '{}'::jsonb,
  active_version integer not null default 1,
  checkout_status text,
  sent_at timestamptz,
  uploaded_pdf_path text,
  uploaded_pdf_original_name text,
  uploaded_pdf_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bpd_invoices add column if not exists sent_at timestamptz;
alter table bpd_invoices add column if not exists uploaded_pdf_path text;
alter table bpd_invoices add column if not exists uploaded_pdf_original_name text;
alter table bpd_invoices add column if not exists uploaded_pdf_uploaded_at timestamptz;
alter table bpd_invoices add column if not exists template_id uuid;
alter table bpd_invoices add column if not exists template_snapshot jsonb;
alter table bpd_invoices add column if not exists template_overrides jsonb not null default '{}'::jsonb;
alter table bpd_invoices add column if not exists active_version integer not null default 1;
alter table bpd_invoices add column if not exists checkout_status text;

create table if not exists bpd_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references bpd_invoices(id) on delete cascade,
  title text not null,
  description text,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bpd_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references bpd_invoices(id),
  project_id uuid not null references bpd_projects(id),
  client_id uuid references bpd_clients(id),
  stripe_customer_id text,
  stripe_event_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_connected_account_id text,
  amount numeric(12,2) not null,
  gross_amount numeric(12,2),
  platform_fee_amount numeric(12,2) not null default 0,
  net_amount numeric(12,2),
  currency text not null default 'usd',
  payment_type text,
  payment_method text,
  payment_model text not null default 'manual',
  stripe_account_context text,
  status text not null,
  paid_at timestamptz,
  refunded_amount numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bpd_payments add column if not exists gross_amount numeric(12,2);
alter table bpd_payments add column if not exists platform_fee_amount numeric(12,2) not null default 0;
alter table bpd_payments add column if not exists net_amount numeric(12,2);
alter table bpd_payments add column if not exists payment_model text;
alter table bpd_payments add column if not exists stripe_account_context text;
alter table bpd_payments add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists bpd_invoice_template_assets (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references bpd_invoice_templates(id) on delete cascade,
  file_id uuid references bpd_files(id),
  asset_type text not null default 'logo',
  created_at timestamptz not null default now()
);

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

create index if not exists bpd_idx_invoices_project_id on bpd_invoices(project_id);
create index if not exists bpd_idx_invoice_versions_invoice_id on bpd_invoice_versions(invoice_id);

alter table bpd_invoices enable row level security;
alter table bpd_invoice_items enable row level security;
alter table bpd_payments enable row level security;
alter table bpd_invoice_templates enable row level security;
alter table bpd_invoice_template_assets enable row level security;
alter table bpd_invoice_versions enable row level security;

drop policy if exists "Admins can manage bpd_invoices" on bpd_invoices;
create policy "Admins can manage bpd_invoices" on bpd_invoices
  for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_invoices" on bpd_invoices;
create policy "Clients can view own bpd_invoices" on bpd_invoices
  for select to authenticated
  using (bpd_can_access_project(project_id) and status <> 'draft' and sent_at is not null);

drop policy if exists "Admins can manage bpd_invoice_items" on bpd_invoice_items;
create policy "Admins can manage bpd_invoice_items" on bpd_invoice_items
  for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

drop policy if exists "Invoice items follow invoice access" on bpd_invoice_items;
create policy "Invoice items follow invoice access" on bpd_invoice_items
  for select to authenticated
  using (
    exists (
      select 1 from bpd_invoices
      where bpd_invoices.id = bpd_invoice_items.invoice_id
        and bpd_can_access_project(bpd_invoices.project_id)
        and (bpd_is_admin() or (bpd_invoices.status <> 'draft' and bpd_invoices.sent_at is not null))
    )
  );

drop policy if exists "Admins can manage bpd_payments" on bpd_payments;
create policy "Admins can manage bpd_payments" on bpd_payments
  for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_payments" on bpd_payments;
create policy "Clients can view own bpd_payments" on bpd_payments
  for select to authenticated using (bpd_can_access_project(project_id));

drop policy if exists "Admins can manage bpd_invoice_templates" on bpd_invoice_templates;
create policy "Admins can manage bpd_invoice_templates" on bpd_invoice_templates
  for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

drop policy if exists "Admins can manage bpd_invoice_template_assets" on bpd_invoice_template_assets;
create policy "Admins can manage bpd_invoice_template_assets" on bpd_invoice_template_assets
  for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

drop policy if exists "Admins can manage bpd_invoice_versions" on bpd_invoice_versions;
create policy "Admins can manage bpd_invoice_versions" on bpd_invoice_versions
  for all to authenticated using (bpd_is_admin()) with check (bpd_is_admin());

drop policy if exists "Clients can view own bpd_invoice_versions" on bpd_invoice_versions;
create policy "Clients can view own bpd_invoice_versions" on bpd_invoice_versions
  for select to authenticated
  using (
    exists (
      select 1
      from bpd_invoices i
      join bpd_clients c on c.id = i.client_id
      where i.id = bpd_invoice_versions.invoice_id
        and c.profile_id = bpd_current_profile_id()
    )
  );

insert into bpd_invoice_templates (name, is_default, config)
select
  'Luxury Event Invoice',
  true,
  '{
    "businessName": "Bridget Pope Designs",
    "accentColor": "#c96f82",
    "paymentTerms": "Payment is due within 15 days unless another schedule is listed on the invoice.",
    "footerNote": "Thank you for trusting Bridget Pope Designs with your celebration.",
    "paymentModel": "manual"
  }'::jsonb
where not exists (select 1 from bpd_invoice_templates where is_default = true);

drop policy if exists "Clients can read own bpd invoice uploads" on storage.objects;
create policy "Clients can read own bpd invoice uploads"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'bpd-invoice-uploads'
  and exists (
    select 1
    from bpd_invoices i
    join bpd_clients c on c.id = i.client_id
    where i.uploaded_pdf_path = name
      and c.profile_id = bpd_current_profile_id()
  )
);
