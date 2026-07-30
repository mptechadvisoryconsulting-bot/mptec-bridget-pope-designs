-- If the homepage gallery is empty (zero visible public_gallery images with
-- show_on_homepage=true), enable homepage for existing visible library images.
-- Safe one-time bootstrap: does nothing when any homepage image already exists.
-- Bridget can still toggle Homepage On/Off per image in Admin → Gallery.

do $$
begin
  if not exists (
    select 1
    from bpd_files
    where visibility = 'public_gallery'
      and is_visible = true
      and show_on_homepage = true
  ) then
    update bpd_files
    set show_on_homepage = true,
        updated_at = now()
    where visibility = 'public_gallery'
      and is_visible = true
      and mime_type like 'image/%';
  end if;
end $$;
