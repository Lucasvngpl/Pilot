-- 0009 — list_items: polymorphic show / season / episode scope
--
-- Applied MANUALLY via the Supabase SQL editor (like every migration here).
--
-- Until now list_items held WHOLE SHOWS only: PK (list_id, tmdb_show_id). To let
-- a list hold a season or an episode — and the SAME show at more than one scope —
-- we adopt the polymorphic scope the other social tables already use
-- (watch_status / ratings / reviews): nullable season_number / episode_number +
-- UNIQUE NULLS NOT DISTINCT. The old composite PK can't coexist with that (it
-- blocks a 2nd scope of the same show), so we swap it for a surrogate uuid id
-- (matches every other social table, and is unambiguous for per-row ops like
-- reorder once a show can appear at multiple scopes) and make the scope tuple
-- the dedupe key.
--
-- NON-BREAKING: existing inserts keep writing whole-show rows (season/episode
-- default NULL = show scope) and behave identically. This is schema-readiness;
-- the scope-aware add/read + the season/episode render variants land with the
-- features that exercise them (ScopeActions + the list picker drill-down).

-- 1. Drop the whole-show-only primary key.
alter table public.list_items drop constraint if exists list_items_pkey;

-- 2. Surrogate id. Named PK (not the auto "list_items_pkey") so step 1's
--    `if exists` can't accidentally drop THIS one on a re-run.
alter table public.list_items
  add column if not exists id uuid not null default gen_random_uuid();
alter table public.list_items
  add constraint list_items_pk primary key (id);

-- 3. The scope columns (nullable; NULL = "applies to the whole show/season").
alter table public.list_items
  add column if not exists season_number  int,
  add column if not exists episode_number int;

-- 4. Scope tuple is the dedupe key. NULLS NOT DISTINCT so a 2nd whole-show row
--    (season + episode both NULL) is still rejected — default PG treats NULL≠NULL
--    and would let duplicates through (the same trick as the other social tables).
alter table public.list_items
  add constraint list_items_scope_uniq
  unique nulls not distinct (list_id, tmdb_show_id, season_number, episode_number);

-- 5. Scope integrity: an episode can't exist without its season (the same CHECK
--    watch_status / ratings / reviews got in 0004) — blocks malformed rows
--    (NULL season + set episode) that would corrupt the JS scope-merge.
alter table public.list_items
  add constraint list_items_scope_chk
  check (episode_number is null or season_number is not null);

-- RLS is UNCHANGED: every list_items policy keys on PARENT-LIST ownership
-- (exists … lists where id = list_id and user_id = auth.uid()), not on the row's
-- own identity, so swapping the PK / adding columns doesn't touch authz.
