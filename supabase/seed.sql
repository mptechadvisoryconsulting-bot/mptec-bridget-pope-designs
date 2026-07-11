insert into bpd_profiles (id, role, first_name, last_name, email, phone, active)
values
  ('00000000-0000-0000-0000-000000000001', 'owner', 'Bridget', 'Pope', 'owner@example.com', '(629) 295-4210', true),
  ('00000000-0000-0000-0000-000000000002', 'client', 'Sample', 'Client', 'client@example.com', '(629) 555-0100', true)
on conflict (id) do nothing;

insert into bpd_leads (
  id,
  lead_number,
  first_name,
  last_name,
  email,
  phone,
  event_type,
  event_date,
  venue,
  city,
  guest_count,
  estimated_budget,
  preferred_consultation_method,
  services_needed,
  message,
  status,
  assigned_admin_id
)
values (
  '10000000-0000-0000-0000-000000000001',
  'BPD-DEMO-0001',
  'Sample',
  'Client',
  'client@example.com',
  '(629) 555-0100',
  'Wedding',
  current_date + interval '45 days',
  'Sample Venue',
  'Murfreesboro',
  125,
  '$5,000 - $8,000',
  'phone',
  array['Wedding design', 'Florals', 'Luxury balloons'],
  'Elegant wedding celebration with blush, ivory, and gold details.',
  'converted',
  '00000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into bpd_clients (id, profile_id, lead_id)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into bpd_projects (
  id,
  project_number,
  client_id,
  lead_id,
  event_name,
  event_type,
  event_date,
  venue_name,
  city,
  guest_count,
  budget,
  color_palette,
  theme,
  status,
  assigned_admin_id
)
values (
  '30000000-0000-0000-0000-000000000001',
  'PRJ-DEMO-0001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Elegant Wedding Celebration',
  'Wedding',
  current_date + interval '45 days',
  'Sample Venue',
  'Murfreesboro',
  125,
  '$5,000 - $8,000',
  'Blush, ivory, gold',
  'Elegant garden wedding',
  'planning',
  '00000000-0000-0000-0000-000000000001'
)
on conflict (id) do nothing;

insert into bpd_conversations (id, project_id, client_id)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')
on conflict (project_id) do nothing;

insert into bpd_business_settings (business_name, business_phone, business_email, timezone)
values ('Bridget Pope Designs', '(629) 295-4210', 'inquiries@example.com', 'America/Chicago');
