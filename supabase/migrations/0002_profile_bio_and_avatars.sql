-- 0002 — profile bio + avatars storage bucket
--
-- NOTE: migrations in this project are applied MANUALLY via the Supabase SQL
-- editor (NOT `supabase db push` — 0001 was applied out-of-band, so push would
-- try to re-run it and fail). This file is the version-controlled source; paste
-- it into the SQL editor to apply. Written to be safely re-runnable.

-- 1. Bio column on profiles, capped to match the Edit Profile UI (160 chars).
alter table public.profiles add column if not exists bio text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_len') then
    alter table public.profiles
      add constraint profiles_bio_len check (bio is null or char_length(bio) <= 160);
  end if;
end $$;

-- 2. Public-read avatars bucket.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3. Storage RLS on storage.objects (RLS is already enabled there).
--    Anyone reads; a user writes only under their own folder:
--    avatars/{user_id}/avatar.ext  →  (storage.foldername(name))[1] = their uid.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
