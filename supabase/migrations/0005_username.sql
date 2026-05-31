-- 0005 — username: non-PII default handle + case-insensitive uniqueness
--
-- Applied MANUALLY via the Supabase SQL editor (see 0002–0004). Re-runnable.
--
-- Why: the old handle_new_user() seeded BOTH username and display_name from the
-- email local-part, and `profiles` is world-readable — so every user's email
-- local-part was published. With username editing now enabled, give new signups
-- a random, non-PII default instead.

-- 1. New-signup default: random handle (`user_<8 hex of the random uuid>`), and
--    NO email-derived display name (null → the UI falls back to the handle).
--    AFFECTS NEW SIGNUPS ONLY — existing rows keep their handle until edited.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    'user_' || substr(new.id::text, 1, 8),  -- uuid v4 is random; unique constraint guards the rare clash
    null
  );
  return new;
end;
$$;

-- 2. Case-insensitive uniqueness — "Lucas" and "lucas" can't coexist. This index
--    is the real, race-safe guard; the client only maps its 23505 to a friendly
--    "that username is taken". (The original case-sensitive `username unique`
--    stays — harmless; both raise 23505 on collision.)
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));
