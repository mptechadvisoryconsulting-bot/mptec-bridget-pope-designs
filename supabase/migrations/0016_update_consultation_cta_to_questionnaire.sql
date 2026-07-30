-- Sync live CMS button copy from consultation CTAs to the questionnaire CTA.
-- 0015 seeds used ON CONFLICT DO NOTHING, so already-applied environments keep old button text.

update bpd_website_content
set
  content = jsonb_set(content, '{primaryButtonText}', '"Submit a Questionnaire"'::jsonb, true),
  updated_at = now()
where section_key = 'hero'
  and coalesce(content ->> 'primaryButtonText', '') in (
    'Book a Consultation',
    'Book a Consultations',
    'Book a Consultation(s)',
    'Book Consultation',
    'Book Consultations',
    'Book Your Consultation',
    'Submit a questionnaire'
  );

update bpd_website_content
set
  content = jsonb_set(content, '{ctaButtonText}', '"Submit a Questionnaire"'::jsonb, true),
  updated_at = now()
where section_key = 'footer'
  and coalesce(content ->> 'ctaButtonText', '') in (
    'Book a Consultation',
    'Book a Consultations',
    'Book a Consultation(s)',
    'Book Consultation',
    'Book Consultations',
    'Book Your Consultation',
    'Submit a questionnaire'
  );
