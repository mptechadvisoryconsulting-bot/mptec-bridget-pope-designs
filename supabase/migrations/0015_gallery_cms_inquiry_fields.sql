-- Gallery metadata, website CMS, and inquiry referral source.
-- Additive only; preserves existing public_gallery files workflow.

alter table bpd_leads
  add column if not exists referral_source text;

alter table bpd_files
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists show_on_homepage boolean not null default false,
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_visible boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

update bpd_files
set title = coalesce(nullif(trim(title), ''), file_name)
where title is null or trim(title) = '';

-- Existing public gallery images remain in the library; homepage stays empty until toggled.
update bpd_files
set is_visible = true
where visibility = 'public_gallery' and is_visible is distinct from true;

create index if not exists bpd_idx_files_gallery_homepage
  on bpd_files (show_on_homepage, sort_order, created_at desc)
  where visibility = 'public_gallery' and is_visible = true and show_on_homepage = true;

create index if not exists bpd_idx_files_gallery_library
  on bpd_files (is_visible, sort_order, created_at desc)
  where visibility = 'public_gallery';

create table if not exists bpd_website_content (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  content jsonb not null default '{}'::jsonb,
  updated_by uuid references bpd_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bpd_idx_website_content_section on bpd_website_content(section_key);

alter table bpd_website_content enable row level security;

drop policy if exists "Admins can manage bpd_website_content" on bpd_website_content;
create policy "Admins can manage bpd_website_content" on bpd_website_content
  for all to authenticated
  using (bpd_is_admin())
  with check (bpd_is_admin());

drop policy if exists "Anyone can read bpd_website_content" on bpd_website_content;
create policy "Anyone can read bpd_website_content" on bpd_website_content
  for select to anon, authenticated
  using (true);

insert into bpd_website_content (section_key, content)
values
  (
    'hero',
    jsonb_build_object(
      'eyebrow', 'Luxury event design and planning',
      'heading', 'Designed Beautifully.',
      'scriptHeading', 'Celebrated Forever.',
      'subheading', 'From unforgettable weddings to milestone celebrations and corporate events, we create stunning experiences with elegant details and flawless execution.',
      'primaryButtonText', 'Submit a Questionnaire',
      'primaryButtonHref', '/inquire',
      'secondaryButtonText', 'Explore Services',
      'secondaryButtonHref', '/services',
      'backgroundImage', '/images/event-hero.png'
    )
  ),
  (
    'services',
    jsonb_build_object(
      'eyebrow', 'Our services',
      'heading', 'Everything You Need for a Flawless Event',
      'items', jsonb_build_array(
        jsonb_build_object('key', 'weddings', 'title', 'Weddings', 'description', 'Elegant design for your most important day.', 'detail', 'Ceremony styling, luxury reception design, tablescapes, floral moments, and vendor-ready timelines.', 'image', null, 'sortOrder', 0, 'visible', true),
        jsonb_build_object('key', 'baby_showers', 'title', 'Baby Showers', 'description', 'Beautiful themes and memorable details.', 'detail', 'Soft color palettes, balloon installations, dessert displays, custom signage, and guest flow planning.', 'image', null, 'sortOrder', 1, 'visible', true),
        jsonb_build_object('key', 'birthdays', 'title', 'Birthdays', 'description', 'Stylish celebrations for kids and adults.', 'detail', 'Statement backdrops, themed tables, and celebration-ready room styling.', 'image', null, 'sortOrder', 2, 'visible', true),
        jsonb_build_object('key', 'corporate', 'title', 'Corporate Events', 'description', 'Professional, polished, perfectly executed.', 'detail', 'Brand-forward event styling, stage decor, florals, and onsite coordination.', 'image', null, 'sortOrder', 3, 'visible', true),
        jsonb_build_object('key', 'balloons', 'title', 'Luxury Balloons', 'description', 'Organic installations with premium finishes.', 'detail', 'Balloon garlands, arches, photo walls, entry statements, and branded installs.', 'image', null, 'sortOrder', 4, 'visible', true),
        jsonb_build_object('key', 'full_planning', 'title', 'Full Planning', 'description', 'One coordinated experience from idea to event day.', 'detail', 'Budget, schedule, vendors, direction, production, and event-day management.', 'image', null, 'sortOrder', 5, 'visible', true)
      )
    )
  ),
  (
    'homepage_gallery',
    jsonb_build_object(
      'eyebrow', 'Designs We Are Now Presenting',
      'heading', 'Beautiful Moments, Perfectly Designed'
    )
  ),
  (
    'featured_designs',
    jsonb_build_object(
      'eyebrow', 'Featured designs',
      'heading', 'Designs We Are Now Presenting',
      'enabled', true
    )
  ),
  (
    'about',
    jsonb_build_object(
      'eyebrow', 'About Bridget Pope Designs',
      'heading', 'Luxury Design With Calm Execution',
      'biography', 'Bridget Pope Designs brings intentional room styling, custom installations, proposal clarity, and client communication into one elegant experience.',
      'portraitImage', '/images/gallery-gold.png',
      'signature', null
    )
  ),
  (
    'contact',
    jsonb_build_object(
      'businessName', 'Bridget Pope Designs',
      'phone', '(629) 295-4210',
      'email', null,
      'website', 'https://bridgetpopedesigns.com',
      'address', null,
      'hours', null,
      'instagram', null,
      'facebook', null,
      'pinterest', null
    )
  ),
  (
    'testimonials',
    jsonb_build_object(
      'eyebrow', 'Client reviews',
      'heading', 'What Clients Are Saying',
      'items', jsonb_build_array(
        jsonb_build_object('id', 't1', 'name', 'Wedding Client', 'event', 'Luxury Wedding Design', 'quote', 'Bridget Pope Designs made every room feel intentional. The process was clear, polished, and honestly calming.', 'visible', true, 'sortOrder', 0),
        jsonb_build_object('id', 't2', 'name', 'Shower Client', 'event', 'Baby Shower Design', 'quote', 'Our guests kept asking who designed the shower. The backdrop, florals, and table styling were flawless.', 'visible', true, 'sortOrder', 1),
        jsonb_build_object('id', 't3', 'name', 'Celebration Client', 'event', 'Milestone Birthday', 'quote', 'The team translated my vision into something more beautiful than I imagined.', 'visible', true, 'sortOrder', 2)
      )
    )
  ),
  (
    'footer',
    jsonb_build_object(
      'ctaHeading', 'Let''s Design Your Next Unforgettable Event',
      'ctaBody', 'Consultations are by appointment. We would love to bring your vision to life.',
      'ctaButtonText', 'Submit a Questionnaire',
      'ctaButtonHref', '/inquire',
      'copyright', 'Bridget Pope Designs. All rights reserved.',
      'quickLinks', jsonb_build_array(
        jsonb_build_object('label', 'Services', 'href', '/services'),
        jsonb_build_object('label', 'Gallery', 'href', '/gallery'),
        jsonb_build_object('label', 'Contact', 'href', '/contact')
      )
    )
  ),
  (
    'social',
    jsonb_build_object(
      'instagram', null,
      'facebook', null,
      'pinterest', null,
      'email', null
    )
  )
on conflict (section_key) do nothing;
