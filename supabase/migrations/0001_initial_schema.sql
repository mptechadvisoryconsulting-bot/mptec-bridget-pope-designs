create extension if not exists "pgcrypto";

create table if not exists bpd_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  role text not null check (role in ('owner','admin','planner','team_member','client')),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_leads (
  id uuid primary key default gen_random_uuid(),
  lead_number text unique not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  event_type text not null,
  event_date date,
  venue text,
  city text,
  guest_count integer,
  estimated_budget text,
  preferred_consultation_method text,
  preferred_consultation_date date,
  preferred_consultation_time text,
  event_colors text,
  event_theme text,
  services_needed text[] not null default '{}',
  message text,
  status text not null default 'new' check (status in ('new','contacted','consultation_scheduled','consultation_completed','proposal_preparing','proposal_sent','awaiting_approval','awaiting_contract','awaiting_deposit','converted','lost','archived')),
  assigned_admin_id uuid references bpd_profiles(id),
  pdf_file_id uuid,
  source text not null default 'public_website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references bpd_profiles(id),
  lead_id uuid references bpd_leads(id),
  stripe_customer_id text,
  billing_address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lead_id)
);

create table if not exists bpd_projects (
  id uuid primary key default gen_random_uuid(),
  project_number text unique default ('PRJ-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  client_id uuid not null references bpd_clients(id),
  lead_id uuid references bpd_leads(id),
  event_name text not null,
  event_type text not null,
  event_date date,
  start_time time,
  end_time time,
  venue_name text,
  venue_address text,
  city text,
  guest_count integer,
  budget text,
  color_palette text,
  theme text,
  status text not null default 'pending' check (status in ('pending','booked','planning','design_in_progress','awaiting_client_approval','finalizing','ready_for_event','event_complete','closed','cancelled')),
  assigned_admin_id uuid references bpd_profiles(id),
  assigned_planner_id uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_consultations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references bpd_leads(id),
  project_id uuid references bpd_projects(id),
  scheduled_at timestamptz,
  timezone text not null default 'America/Chicago',
  meeting_type text check (meeting_type in ('phone','video','in_person')),
  meeting_link text,
  location text,
  status text not null default 'requested' check (status in ('requested','scheduled','completed','cancelled','no_show')),
  notes text,
  created_by uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  proposal_number text unique default ('PROP-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  title text,
  introduction text,
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  deposit_amount numeric(12,2) not null default 0,
  expiration_date date,
  status text not null default 'draft' check (status in ('draft','sent','viewed','approved','rejected','expired')),
  approved_at timestamptz,
  public_token text unique,
  created_by uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references bpd_proposals(id) on delete cascade,
  title text not null,
  description text,
  category text,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bpd_contracts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  proposal_id uuid references bpd_proposals(id),
  contract_number text unique default ('CTR-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  content text,
  status text not null default 'draft' check (status in ('draft','sent','viewed','signed','voided')),
  client_signature text,
  client_signed_at timestamptz,
  owner_signature text,
  owner_signed_at timestamptz,
  signed_document_url text,
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
  status text not null default 'draft' check (status in ('draft','pending','processing','partially_paid','paid','failed','overdue','cancelled','refunded','partially_refunded')),
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  amount numeric(12,2) not null,
  currency text not null default 'usd',
  payment_type text,
  payment_method text,
  status text not null,
  paid_at timestamptz,
  refunded_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_stripe_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists bpd_design_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','shared','awaiting_feedback','approved','revision_requested')),
  client_visible boolean not null default false,
  created_by uuid references bpd_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  title text not null,
  description text,
  milestone_type text,
  due_date date,
  completed_at timestamptz,
  status text not null default 'open',
  client_visible boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references bpd_projects(id),
  assigned_to uuid references bpd_profiles(id),
  title text not null,
  description text,
  due_date date,
  priority text not null default 'normal',
  status text not null default 'open',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bpd_conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  client_id uuid not null references bpd_clients(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id)
);

create table if not exists bpd_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references bpd_projects(id),
  lead_id uuid references bpd_leads(id),
  uploaded_by uuid references bpd_profiles(id),
  category text,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size integer,
  visibility text not null default 'private_admin' check (visibility in ('private_admin','client_visible','client_upload','public_gallery')),
  created_at timestamptz not null default now()
);

alter table bpd_leads add constraint bpd_leads_pdf_file_fk foreign key (pdf_file_id) references bpd_files(id) deferrable initially deferred;

create table if not exists bpd_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references bpd_conversations(id),
  sender_id uuid references bpd_profiles(id),
  body text not null,
  attachment_file_id uuid references bpd_files(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bpd_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references bpd_profiles(id),
  project_id uuid references bpd_projects(id),
  lead_id uuid references bpd_leads(id),
  type text not null,
  title text not null,
  message text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bpd_event_reminders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references bpd_projects(id),
  days_before_event integer not null,
  admin_notification_sent_at timestamptz,
  client_notification_sent_at timestamptz,
  admin_email_sent_at timestamptz,
  client_email_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(project_id, days_before_event)
);

create table if not exists bpd_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references bpd_profiles(id),
  project_id uuid references bpd_projects(id),
  lead_id uuid references bpd_leads(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create table if not exists bpd_automation_logs (
  id uuid primary key default gen_random_uuid(),
  automation_type text not null,
  project_id uuid references bpd_projects(id),
  lead_id uuid references bpd_leads(id),
  recipient text,
  status text not null,
  error_message text,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bpd_business_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text not null default 'Bridget Pope Designs',
  business_phone text not null default '(629) 295-4210',
  business_email text,
  address text,
  timezone text not null default 'America/Chicago',
  stripe_account_mode text not null default 'single_owner',
  default_tax_rate numeric(5,4) not null default 0,
  default_deposit_percentage numeric(5,4) not null default 0.5,
  consultation_duration_minutes integer not null default 45,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bpd_idx_profiles_auth_user_id on bpd_profiles(auth_user_id);
create index if not exists bpd_idx_profiles_role on bpd_profiles(role);
create index if not exists bpd_idx_leads_status on bpd_leads(status);
create index if not exists bpd_idx_projects_client_id on bpd_projects(client_id);
create index if not exists bpd_idx_projects_assigned_admin_id on bpd_projects(assigned_admin_id);
create index if not exists bpd_idx_invoices_project_id on bpd_invoices(project_id);
create index if not exists bpd_idx_notifications_recipient_unread on bpd_notifications(recipient_id, read_at);
create index if not exists bpd_idx_messages_conversation_id on bpd_messages(conversation_id);
create index if not exists bpd_idx_files_project_id on bpd_files(project_id);
