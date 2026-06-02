-- 0008 — backfill: materialize show-scope 'watched' (TASK 1)
--
-- Applied MANUALLY via the Supabase SQL editor (like every other migration here
-- — NOT `supabase db push`). One-time; safe to re-run (idempotent).
--
-- Before TASK 1, "watched" was never stored — the Shows grid re-derived it at
-- read time by unioning ratings + reviews + episode ticks. TASK 1 makes the
-- rating/review mutations write watch_status='watched' at log time. This backfill
-- does the same for rows logged BEFORE that change, so the strict Watched filter
-- (TASK 2) doesn't lose them.
--
-- A show-scope rating OR a show-scope PUBLISHED review ⇒ watched. We ONLY add the
-- implicit-watched rows the old union surfaced; ON CONFLICT DO NOTHING means we
-- never reclassify an existing explicit watching/watchlist/watched row.
insert into public.watch_status (user_id, tmdb_show_id, season_number, episode_number, status)
-- Cast the NULLs: a bare `null` literal types as text, but season_number /
-- episode_number are integer columns — without the cast Postgres rejects the
-- insert ("column is of type integer but expression is of type text").
select distinct user_id, tmdb_show_id, null::int, null::int, 'watched'
from (
  select user_id, tmdb_show_id from public.ratings
   where season_number is null and episode_number is null
  union
  select user_id, tmdb_show_id from public.reviews
   where season_number is null and episode_number is null and is_draft = false
) src
on conflict (user_id, tmdb_show_id, season_number, episode_number) do nothing;

-- Verify after applying:
--   select count(*) from public.watch_status
--    where status = 'watched' and season_number is null and episode_number is null;
