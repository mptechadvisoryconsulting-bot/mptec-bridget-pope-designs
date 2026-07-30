-- Hide placeholder/fake testimonials from public surfaces.
-- Keep rows editable in Website Content so real reviews can be published later.
update bpd_website_content
set
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        content,
        '{enabled}',
        'false'::jsonb,
        true
      ),
      '{showOnHomepage}',
      'false'::jsonb,
      true
    ),
    '{items}',
    coalesce(
      (
        select jsonb_agg(
          item || jsonb_build_object('visible', false)
          order by coalesce((item ->> 'sortOrder')::int, 0)
        )
        from jsonb_array_elements(coalesce(content -> 'items', '[]'::jsonb)) as item
      ),
      '[]'::jsonb
    ),
    true
  ),
  updated_at = now()
where section_key = 'testimonials';
