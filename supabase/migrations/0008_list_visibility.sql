-- 0008_list_visibility.sql — public/private flag on lists (Pilot's first private data).
--
-- Adds `is_public` so a list can be hidden from public surfaces. Defaults TRUE,
-- so every existing list stays public and nothing changes today.
--
-- Apply MANUALLY in the Supabase SQL editor (this project doesn't run db push).
--
-- SCOPE — this migration only ADDS the column. The Show Detail › Lists tab filters
-- `is_public = true` at the QUERY level (useShowLists), giving the no-leak discipline
-- on the public show page. The broader "public/private" feature — a UI to toggle a
-- list private + app-wide RLS read-scoping (hide private lists everywhere, not just
-- the show page) — stays deferred. RLS is intentionally UNCHANGED here: `lists` keeps
-- public-SELECT, matching how drafts are handled (query-level filtering, see 0007).

alter table public.lists
  add column if not exists is_public boolean not null default true;

-- Speeds the "public lists that include show X" lookup (list_items → lists join).
create index if not exists lists_is_public_idx on public.lists (is_public);
