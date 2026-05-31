-- 0004 — security hardening (from the pre-launch audit)
--
-- Applied MANUALLY via the Supabase SQL editor (see 0002/0003). Re-runnable.

-- 1. list_items UPDATE was missing a WITH CHECK. USING only validates the row
--    you may TARGET; WITH CHECK validates what the row may BECOME. Without it a
--    user could `update list_items set list_id = <a list they don't own>` —
--    USING passes (the original row is in their list), and nothing re-validated
--    the new parent. Add the same parent-ownership predicate as WITH CHECK so a
--    re-parented row must still belong to a list the caller owns. (Low real-world
--    risk — the app deletes+inserts rather than re-parenting — but a genuine gap.)
drop policy if exists list_items_update_own on public.list_items;
create policy list_items_update_own on public.list_items
  for update
  using (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid())
  );

-- 2. Scope-integrity: an episode can't exist without a season. Blocks
--    nonsensical (season NULL, episode N) rows that would corrupt the JS
--    scope-merge (it keys on season/episode nullability). Wrapped so the file
--    stays re-runnable. NOTE: if any violating row already exists the ALTER
--    fails — none should, since the app never writes that shape.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watch_status_scope_chk') then
    alter table public.watch_status add constraint watch_status_scope_chk
      check (episode_number is null or season_number is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ratings_scope_chk') then
    alter table public.ratings add constraint ratings_scope_chk
      check (episode_number is null or season_number is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reviews_scope_chk') then
    alter table public.reviews add constraint reviews_scope_chk
      check (episode_number is null or season_number is not null);
  end if;
end $$;
