-- Owner-friendly ops polish: offline payment instructions, nav toggles,
-- payment reminder opt-in, and FAQ CMS seed.

alter table bpd_business_settings
  add column if not exists cash_app_handle text,
  add column if not exists zelle_handle text,
  add column if not exists venmo_handle text,
  add column if not exists bank_transfer_notes text,
  add column if not exists check_payable_to text,
  add column if not exists payment_instructions_notes text,
  add column if not exists payment_reminders_enabled boolean not null default false,
  add column if not exists show_inventory_nav boolean not null default false,
  add column if not exists show_team_nav boolean not null default false,
  add column if not exists show_contracts_nav boolean not null default true;

comment on column bpd_business_settings.cash_app_handle is 'Cash App $cashtag for offline invoice payments';
comment on column bpd_business_settings.zelle_handle is 'Zelle email/phone for offline invoice payments';
comment on column bpd_business_settings.venmo_handle is 'Venmo handle for offline invoice payments';
comment on column bpd_business_settings.bank_transfer_notes is 'Bank transfer / ACH instructions for offline payments';
comment on column bpd_business_settings.check_payable_to is 'Payee name for paper checks';
comment on column bpd_business_settings.payment_instructions_notes is 'Extra offline payment notes shown on invoices';
comment on column bpd_business_settings.payment_reminders_enabled is 'When true, daily cron may email/notify about upcoming/overdue invoices';
comment on column bpd_business_settings.show_inventory_nav is 'When true, Inventory appears in the owner sidebar';
comment on column bpd_business_settings.show_team_nav is 'When true, Team appears in the owner sidebar';
comment on column bpd_business_settings.show_contracts_nav is 'When true, Contracts appears in the owner sidebar (still hidden when empty if preferred in UI)';

-- FAQ section for Website CMS (editable offline-payment wording).
insert into bpd_website_content (section_key, content)
values (
  'faq',
  jsonb_build_object(
    'eyebrow', 'Questions',
    'heading', 'Planning Details',
    'items', jsonb_build_array(
      jsonb_build_object(
        'id', 'faq-inquire-timing',
        'question', 'How early should I inquire?',
        'answer', 'For weddings and large events, inquire 6 to 12 months out. Smaller installations can often be booked 4 to 8 weeks ahead.',
        'visible', true,
        'sortOrder', 0
      ),
      jsonb_build_object(
        'id', 'faq-rentals',
        'question', 'Do you offer rentals?',
        'answer', 'Select event pieces may be included inside a full design plan when they support the overall event concept.',
        'visible', true,
        'sortOrder', 1
      ),
      jsonb_build_object(
        'id', 'faq-payments',
        'question', 'Where are proposals, contracts, and payments handled?',
        'answer', 'Proposals, contracts, and invoices live in your client portal alongside project updates, designs, files, messages, and event details. Payments are arranged offline with Bridget Pope Designs (Cash App, Zelle, Venmo, check, or bank transfer as arranged).',
        'visible', true,
        'sortOrder', 2
      ),
      jsonb_build_object(
        'id', 'faq-travel',
        'question', 'Do you travel?',
        'answer', 'The primary service area is Murfreesboro, TN and surrounding areas, with travel available by quote.',
        'visible', true,
        'sortOrder', 3
      )
    )
  )
)
on conflict (section_key) do nothing;
