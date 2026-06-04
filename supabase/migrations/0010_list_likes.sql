-- 0010_list_likes.sql — likes on lists (mirror of review_likes for the social graph).
--
-- Lists were missing the like primitive that reviews already have (review_likes,
-- 0001). This adds the symmetric table so a list can be liked exactly like a
-- review: one row per (list, user), public read, write-your-own-only.
--
-- Apply MANUALLY in the Supabase SQL editor (this project doesn't run db push).
-- No Edge Function deploy is needed — likes are read/written from the client over
-- RLS-protected direct queries (the TMDb-key rule doesn't apply to our own social
-- data).
--
-- Numbering: 0008 and 0009 were already taken (0008_backfill_watched,
-- 0008_list_visibility, 0009_list_items_scope), so this is 0010.

-- -----------------------------------------------------------------------------
-- list_likes — many-to-many between users and lists (shape copied from review_likes)
-- -----------------------------------------------------------------------------
create table if not exists public.list_likes (
  list_id    uuid        not null references public.lists(id)     on delete cascade,
  user_id    uuid        not null references public.profiles(id)  on delete cascade,
  created_at timestamptz not null default now(),
  -- The composite PK IS the uniqueness guarantee: a user can like a given list at
  -- most once. A rapid double-tap that races to two inserts hits this and 409s —
  -- nets to one row (or zero after the toggle-off), never two.
  primary key (list_id, user_id)
);

-- PK indexes (list_id, user_id) cover "likes on this list". Add the reverse index
-- for the future "lists this user has liked" query (mirrors review_likes_user_idx).
create index if not exists list_likes_user_idx on public.list_likes (user_id);

alter table public.list_likes enable row level security;

-- RLS mirrors review_likes exactly: anyone can read like counts/likers (public
-- SELECT), but you can only insert/delete YOUR OWN like row.
create policy list_likes_select_all on public.list_likes
  for select using (true);
create policy list_likes_insert_own on public.list_likes
  for insert with check (auth.uid() = user_id);
create policy list_likes_delete_own on public.list_likes
  for delete using (auth.uid() = user_id);
