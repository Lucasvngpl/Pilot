-- 0011_watch_status_watched_at.sql
-- Adds a user-choosable "watched date" to watch_status. Apply MANUALLY in the
-- Supabase SQL editor (this project never runs `db push`). Idempotent.
--
-- Why a DATE (not timestamptz): the Diary groups + labels by CALENDAR DAY, and a
-- date is timezone-free — the day a user picks is the day every device shows.
-- Within-day ordering of quick-marks is preserved by the secondary sort on
-- updated_at (a real timestamptz), so we lose nothing by dropping the time.

-- 1. The column. Default current_date → every quick-mark lands on "today".
--    NOT NULL (after backfill) so read paths never branch on a missing value.
alter table public.watch_status
  add column if not exists watched_at date not null default current_date;

-- 2. Backfill existing rows to the day they were last touched, so historical
--    Diary / Watched-grid order is unchanged on the first read after migrating.
--    updated_at::date truncates the timestamptz to its calendar day (UTC on
--    Supabase) — fine for backfill. Run right after the ALTER (no real edits can
--    exist in between), so the DEFAULT-stamped rows are all re-targeted.
update public.watch_status set watched_at = updated_at::date;

-- 3. Hot-query index: the Diary and the Profile→Shows→Watched grid both sort
--    watched_at DESC, tie-broken by updated_at DESC (stable intra-day order).
--    Per-user, status-filtered to match the actual queries.
create index if not exists watch_status_user_watched_idx
  on public.watch_status (user_id, status, watched_at desc, updated_at desc);

-- NOTE: the existing set_watch_status_updated_at BEFORE-UPDATE trigger only
-- assigns updated_at, never watched_at — so editing a row's date bumps
-- updated_at (correct: "row last touched") while watched_at holds the chosen day.
