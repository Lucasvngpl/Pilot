-- 0016_bulk_add_watchlist.sql — batched "add these to my watchlist" RPC.
--
-- Mirror of bulk_mark_watched (0015): the onboarding "starter recommendations"
-- step lets a new user tap several shows to watch later, and we flush them in ONE
-- round-trip after they sign in. supabase-js .upsert([...]) would overwrite EVERY
-- column on conflict — here that would DOWNGRADE a show the user already marked
-- watched/watching back to 'watchlist'. So we INSERT and do NOTHING on conflict:
-- a recommendation only lands if the user has no status for that show yet.
--
-- SECURITY DEFINER + auth.uid() so it only ever writes the caller's own rows.
-- Apply via the Supabase MCP (apply_migration) like 0012–0015.
create or replace function public.bulk_add_watchlist(ids int[])
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.watch_status
    (user_id, tmdb_show_id, season_number, episode_number, status)
  select auth.uid(), id, null, null, 'watchlist'
  from unnest(ids) as id
  where auth.uid() is not null
  on conflict (user_id, tmdb_show_id, season_number, episode_number)
  do nothing;
$$;

revoke execute on function public.bulk_add_watchlist(int[]) from public, anon;
grant execute on function public.bulk_add_watchlist(int[]) to authenticated;
