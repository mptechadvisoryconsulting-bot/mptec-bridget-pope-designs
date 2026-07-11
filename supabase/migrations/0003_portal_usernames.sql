alter table bpd_profiles
  add column if not exists username text,
  add column if not exists portal_created_by uuid references bpd_profiles(id),
  add column if not exists portal_created_at timestamptz;

update bpd_profiles
set username = lower(split_part(email, '@', 1))
where username is null;

create unique index if not exists bpd_profiles_username_key
  on bpd_profiles (lower(username))
  where username is not null;

update bpd_business_settings
set business_email = coalesce(business_email, 'inquiries@example.com')
where business_email is null;
