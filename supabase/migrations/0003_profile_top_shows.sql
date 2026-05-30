-- 0003 — Top-4 favorite shows per profile
--
-- NOTE: migrations in this project are applied MANUALLY via the Supabase SQL
-- editor (NOT `supabase db push` — 0001 was applied out-of-band, so push would
-- try to re-run it and fail). This file is the version-controlled source; paste
-- it into the SQL editor to apply. Written to be safely re-runnable.
--
-- A user's "Top 4" favorite shows. Whole-show scope only (no season/episode),
-- so a plain composite PK (user_id, tmdb_show_id) gives natural per-user dedup —
-- same shape as list_items. `position` is 1..4 in add-order (app caps at 4); no
-- unique(user_id, position) on purpose, mirroring list_items.

create table if not exists public.profile_top_shows (
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  tmdb_show_id int         not null,
  position     int         not null check (position >= 1),
  added_at     timestamptz not null default now(),
  primary key (user_id, tmdb_show_id)
);

alter table public.profile_top_shows enable row level security;

-- "read public, write only own" — same shape as watch_status / ratings
-- (0001_init.sql:312-320). drop-if-exists first so this file stays re-runnable.
drop policy if exists profile_top_shows_select_all on public.profile_top_shows;
create policy profile_top_shows_select_all on public.profile_top_shows
  for select using (true);

drop policy if exists profile_top_shows_insert_own on public.profile_top_shows;
create policy profile_top_shows_insert_own on public.profile_top_shows
  for insert with check (auth.uid() = user_id);

drop policy if exists profile_top_shows_update_own on public.profile_top_shows;
create policy profile_top_shows_update_own on public.profile_top_shows
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists profile_top_shows_delete_own on public.profile_top_shows;
create policy profile_top_shows_delete_own on public.profile_top_shows
  for delete using (auth.uid() = user_id);
