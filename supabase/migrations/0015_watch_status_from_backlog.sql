-- 0015_watch_status_from_backlog.sql — bulk "I've seen these" backlog marks.
--
-- A backlog mark records that the user has watched a show, but on an UNKNOWN day
-- (not today). So: `from_backlog = true` and `watched_at = NULL`. These rows fill
-- the Shows→Watched grid but are excluded from the Diary and from any time-based
-- aggregation (a real date is required for real signal — see CLAUDE.md).
--
-- Applied via the Supabase MCP (apply_migration). Existing rows default false +
-- keep their dates, so nothing changes for them.

alter table public.watch_status add column if not exists from_backlog boolean not null default false;
alter table public.watch_status alter column watched_at drop not null;

-- NON-DESTRUCTIVE batched bulk mark. supabase-js .upsert([...]) would overwrite
-- EVERY payload column on conflict — flipping from_backlog / nulling watched_at on
-- a row that was a genuine dated log/review, silently deleting its Diary entry. An
-- RPC lets us update STATUS ONLY on conflict. SECURITY DEFINER + auth.uid() so it
-- only ever writes the caller's own rows.
create or replace function public.bulk_mark_watched(ids int[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.watch_status
    (user_id, tmdb_show_id, season_number, episode_number, status, from_backlog, watched_at)
  select auth.uid(), id, null, null, 'watched', true, null
  from unnest(ids) as id
  where auth.uid() is not null
  on conflict (user_id, tmdb_show_id, season_number, episode_number)
  do update set status = 'watched';
$$;

revoke execute on function public.bulk_mark_watched(int[]) from public, anon;
grant execute on function public.bulk_mark_watched(int[]) to authenticated;
