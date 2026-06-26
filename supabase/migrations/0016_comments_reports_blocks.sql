-- =============================================================================
-- 0016_comments_reports_blocks.sql — comments + the App Store 1.2 moderation pair
-- =============================================================================
-- PIL-24. Three new social tables:
--
--   comments — flat (non-threaded) comments on a review OR a list. Polymorphic
--              target via (target_type, target_id), mirroring the show/season/
--              episode scope discipline the other social tables use.
--   reports  — a user flags a piece of UGC (review / list / comment / profile)
--              for review. Feeds the manual admin-removal queue Apple 1.2 needs.
--   blocks   — a user blocks another user. GLOBAL: the blocker stops seeing the
--              blocked user's content everywhere, and the follow edges between
--              them are torn down (both directions) by the block_user() RPC.
--
-- Apply MANUALLY in the Supabase SQL editor (this project doesn't run db push —
-- 0001 was applied out-of-band, so a push would try to re-run it and fail). After
-- applying, redeploy get-reviews and deploy get-comments (both block-filter
-- server-side — see the function headers).
--
-- RLS refresher (the rule every social table follows here):
--   * `alter table ... enable row level security` flips a table to deny-by-default.
--   * each `create policy` GRANTS access for the rows its USING/WITH CHECK matches;
--     policies are additive (OR'd together), never subtractive.
--   * `auth.uid()` = the caller's user id from their JWT, or NULL when anonymous.
--   * the service-role key (Edge Functions' adminClient) bypasses RLS entirely.
-- The shape we repeat: public SELECT (`using (true)`) + writes gated to your own
-- rows (`auth.uid() = user_id`). reports is the exception — it has NO public
-- SELECT, so only the service role (an admin) can read the moderation queue.


-- -----------------------------------------------------------------------------
-- 1. comments — flat comments on a review or a list
-- -----------------------------------------------------------------------------
-- Polymorphic target: (target_type, target_id) says WHAT is being commented on.
-- We deliberately DON'T add an FK to reviews/lists here, because a single column
-- can't FK two different tables — the same trick the rest of the schema uses for
-- the show/season/episode scope. Integrity is enforced by the app + the
-- ON DELETE CASCADE we get for free on the AUTHOR via profiles (a deleted user's
-- comments vanish). A deleted review/list leaves orphan comment rows, but every
-- read is scoped by (target_type, target_id), so an orphan is simply never
-- fetched (and the read paths only ask about targets that still exist).
--
-- No UNIQUE here: comments are INSERT-style (many per target, like reviews —
-- not UPSERT like ratings/watch_status), so there's no nullable-scope uniqueness
-- to protect and therefore no need for `UNIQUE NULLS NOT DISTINCT`. Both target
-- columns are NOT NULL, so even if we wanted uniqueness, plain UNIQUE would do —
-- the NULLS-NOT-DISTINCT footgun only bites when a key column can be NULL.
create table public.comments (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  target_type text        not null check (target_type in ('review', 'list')),
  target_id   uuid        not null,
  body        text        not null check (length(btrim(body)) > 0),
  created_at  timestamptz not null default now()
);

-- The hot read: "all comments on THIS target, oldest-first" (a comment thread
-- reads top-to-bottom chronologically). Composite index serves it without a sort.
create index comments_target_idx
  on public.comments (target_type, target_id, created_at);

-- Reverse index for the block-filter / "this user's comments" lookups (the
-- moderation read paths filter OUT a blocked author by user_id).
create index comments_user_idx on public.comments (user_id);

alter table public.comments enable row level security;

-- Anyone (incl. anonymous) can READ comments; you can only INSERT/DELETE your own.
-- No UPDATE policy → comments aren't editable in v1 (post or delete, like a chat
-- message). Add an update_own policy later if inline editing is wanted.
create policy comments_select_all on public.comments
  for select using (true);
create policy comments_insert_own on public.comments
  for insert with check (auth.uid() = user_id);
create policy comments_delete_own on public.comments
  for delete using (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 2. reports — flag a piece of UGC for manual review (Apple Guideline 1.2)
-- -----------------------------------------------------------------------------
-- One row = "user X reported {target} for {reason}". This is the minimum viable
-- moderation queue: an admin reads it with the service-role key and removes the
-- offending content / ejects the user by hand (the 24h-response commitment 1.2
-- requires). A submission-time text filter can come later — the report→remove
-- loop is the part Apple actually gates on.
--
-- target_type includes 'profile' so a user (bio / username) can be reported too,
-- not just their reviews/lists/comments.
--
-- UNIQUE(reporter_id, target_type, target_id): a user can report a given item at
-- most once (a second tap 23505s → the client treats it as "already reported").
-- All three key columns are NOT NULL, so plain UNIQUE is correct here.
create table public.reports (
  id          uuid        primary key default gen_random_uuid(),
  reporter_id uuid        not null references public.profiles(id) on delete cascade,
  target_type text        not null check (target_type in ('review', 'list', 'comment', 'profile')),
  target_id   uuid        not null,
  reason      text        not null check (length(btrim(reason)) > 0),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

-- Queue scan order for the admin: newest reports first.
create index reports_recent_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

-- INSERT only, and only as yourself. There is intentionally NO select/update/
-- delete policy: clients can file a report but can NEVER read the queue (that
-- would leak who-reported-what). Only the service-role key (admin tooling) reads
-- and acts on reports.
create policy reports_insert_own on public.reports
  for insert with check (auth.uid() = reporter_id);


-- -----------------------------------------------------------------------------
-- 3. blocks — a directed "A has blocked B" edge
-- -----------------------------------------------------------------------------
-- Composite PK (blocker_id, blocked_id) = a user blocks another at most once.
-- Content-hiding is ONE-DIRECTIONAL by design: blocking hides the blocked user's
-- content FROM THE BLOCKER (the brief: "hides that user's content everywhere for
-- the blocker"). The blocker is the party that needs protecting, and one-way
-- avoids the privacy leak of telling someone "user X blocked you" (which a
-- bidirectional read filter would require exposing).
create table public.blocks (
  blocker_id uuid        not null references public.profiles(id) on delete cascade,
  blocked_id uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

-- Reverse index: "who has blocked B?" — not used by the one-directional read
-- filter, but cheap and handy for future admin tooling.
create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- You can only SEE / make / drop YOUR OWN block rows (blocker_id = you). Crucially
-- the SELECT policy is `blocker_id = auth.uid()` (NOT `using (true)`) so the block
-- list stays private — nobody can read who blocked them. The read filters
-- (get-reviews / get-comments / useActivityFeed / …) therefore only ever learn
-- about blocks the CALLER made, which is exactly the one-directional model above.
create policy blocks_select_own on public.blocks
  for select using (auth.uid() = blocker_id);
create policy blocks_insert_own on public.blocks
  for insert with check (auth.uid() = blocker_id);
create policy blocks_delete_own on public.blocks
  for delete using (auth.uid() = blocker_id);


-- -----------------------------------------------------------------------------
-- 4. block_user(target) — block + tear down both follow edges, atomically
-- -----------------------------------------------------------------------------
-- Why an RPC instead of a plain client insert: blocking must ALSO remove the
-- follow edge in BOTH directions. RLS on `follows` only lets a user delete edges
-- where THEY are the follower (follows_delete_own), so the client physically
-- cannot delete the "B follows A" row by itself. A SECURITY DEFINER function runs
-- as its owner (postgres) and bypasses RLS, so it can delete both — but we gate
-- on auth.uid() inside so a caller can only ever block on their own behalf.
--
-- `set search_path = public` is the standard hardening for SECURITY DEFINER: it
-- stops a caller from shadowing `follows`/`blocks` with a malicious same-named
-- table in another schema and tricking the elevated function into writing it.
create or replace function public.block_user(blocked_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to block';
  end if;
  if auth.uid() = blocked_user then
    raise exception 'cannot block yourself';
  end if;

  -- Idempotent: blocking an already-blocked user is a no-op, not an error.
  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), blocked_user)
  on conflict (blocker_id, blocked_id) do nothing;

  -- Remove the relationship both ways so neither lingers in a follower/following
  -- list. (The blocker also stops seeing the blocked user's content via the read
  -- filters, so this is the "no interaction" half of the block.)
  delete from public.follows
  where (follower_id = auth.uid() and followee_id = blocked_user)
     or (follower_id = blocked_user and followee_id = auth.uid());
end;
$$;

-- SECURITY DEFINER functions must have EXECUTE granted to the roles that call
-- them (the client's JWT carries the `authenticated` role).
grant execute on function public.block_user(uuid) to authenticated;

-- Unblocking is just deleting your own block row, which RLS (blocks_delete_own)
-- already permits from the client — no RPC needed. We do NOT re-create the
-- removed follow edges on unblock (the user would have to follow again), matching
-- how every major app handles it.
