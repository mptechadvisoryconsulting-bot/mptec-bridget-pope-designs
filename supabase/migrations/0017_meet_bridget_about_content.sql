-- Seed / refresh About (Meet Bridget) CMS fields used on homepage + /about.
-- Safe to re-run: merges into existing about row without wiping unrelated sections.

insert into bpd_website_content (section_key, content)
values (
  'about',
  jsonb_build_object(
    'eyebrow', 'Meet the Designer',
    'heading', 'Meet Bridget Pope',
    'biography', E'For as long as I can remember, I''ve had a passion for creating beautiful spaces and unforgettable celebrations. What began as a love for decorating has grown into a lifelong commitment to designing elegant weddings and special events that reflect each client''s unique vision.\n\nOver the years, I''ve embraced both timeless and modern event design, combining creativity, attention to detail, and thoughtful planning to create meaningful experiences. As a Master of Business Administration graduate, a Certified Event Designer & Draping Specialist, and a breast cancer survivor, I approach every celebration with gratitude, faith, and a genuine love for serving others.\n\nWhether you''re planning a wedding, baby shower, birthday celebration, or corporate event, my goal is simple—to bring your vision to life with beauty, elegance, and excellence.',
    'portraitImage', '/images/bridget-pope-portrait.jpg',
    'signature', 'Let''s create something beautiful together.',
    'primaryButtonText', 'Submit Event Questionnaire',
    'primaryButtonHref', '/inquire',
    'secondaryButtonText', 'Learn More',
    'secondaryButtonHref', '/about'
  )
)
on conflict (section_key) do update
set
  content = excluded.content,
  updated_at = now()
where bpd_website_content.content ->> 'heading' in (
  'Luxury Design With Calm Execution',
  'Meet Bridget Pope'
)
or bpd_website_content.content ->> 'portraitImage' in (
  '/images/gallery-gold.png',
  '/images/bridget-pope-portrait.jpg'
);
