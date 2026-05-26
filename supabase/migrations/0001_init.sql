-- =============================================================================
-- Pilot — Initial schema (0001_init.sql)
-- =============================================================================
-- This migration creates the social graph for Pilot.
--
-- Responsibility split:
--   - TMDb owns the catalog (shows / seasons / episodes / cast / images).
--     We never copy the whole catalog — only IDs and a JSONB blob of the
--     subset of shows we curate (see `shows_cache`).
--   - We own the social graph: users, follows, watch_status, ratings,
--     reviews, lists. All keyed off `auth.users(id)`.
--
-- Catalog references are stored as:
--   tmdb_show_id    int                -- which show
--   season_number   int  NULL allowed  -- which season inside it (NULL = none)
--   episode_number  int  NULL allowed  -- which episode inside it  (NULL = none)
--
-- The three NULL "levels" let one table model three scopes at once:
--   (show_id, NULL, NULL)    -> the whole show
--   (show_id, 2,    NULL)    -> all of season 2
--   (show_id, 2,    5)       -> S2E5 specifically
--
-- That polymorphism is the heart of Pilot. The trickiest knock-on effect is
-- uniqueness — see `nulls not distinct` on each table for the fix.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Helper functions
-- -----------------------------------------------------------------------------

-- Generic "stamp updated_at = now() on every UPDATE" trigger function.
-- We use a database trigger instead of trusting clients to set updated_at
-- because the database is the only place we can guarantee it actually happens.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. profiles — 1:1 with auth.users
-- -----------------------------------------------------------------------------
-- Why a separate table?
--   `auth.users` is owned by the Supabase auth schema and we shouldn't add
--   app-specific columns to it. `profiles` mirrors the user id and stores
--   our own fields (username, display_name, avatar_url).
--
-- ON DELETE CASCADE: if a user deletes their auth account, their profile
-- row dies with it, and (via the cascades further down) so do all their
-- ratings / reviews / etc. One delete cleans up the whole graph.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);


-- Auto-create a profile when a new auth user signs up.
--
-- SECURITY DEFINER means "run as the function's owner (postgres), not as the
-- caller (supabase_auth_admin)." Without this, the auth role can't INSERT
-- into public.profiles.
--
-- The `set search_path = public` line is a hardening step — without it, a
-- SECURITY DEFINER function can be tricked into running code from a malicious
-- schema. Pinning the search path closes that door.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    -- Initial username: email-local-part + 6-char id suffix.
    -- The id suffix guarantees uniqueness (two `lucas@*.com` accounts won't
    -- collide). Email can be null with Apple's hide-my-email, so coalesce.
    -- Users can change their username later from the profile screen.
    coalesce(split_part(new.email, '@', 1), 'user') || '_' || substr(new.id::text, 1, 6),
    coalesce(split_part(new.email, '@', 1), 'user')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 3. follows — directed edges between users
-- -----------------------------------------------------------------------------
-- (A follows B) and (B follows A) are two distinct rows. The composite PK
-- prevents duplicate edges and gives us a fast index on follower_id.
create table public.follows (
  follower_id uuid        not null references public.profiles(id) on delete cascade,
  followee_id uuid        not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint no_self_follow check (follower_id <> followee_id)
);

-- The PK index covers "who does A follow?" queries. We add a second index
-- to cover the reverse direction ("who follows B?") without scanning the
-- whole table.
create index follows_followee_idx on public.follows (followee_id);


-- -----------------------------------------------------------------------------
-- 4. watch_status — a user's tracking state for a show / season / episode
-- -----------------------------------------------------------------------------
-- One row per (user, scope). Updating the status (e.g., watchlist → watching)
-- is an UPDATE, not an insert.
create table public.watch_status (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  tmdb_show_id   int         not null,
  season_number  int,
  episode_number int,
  status         text        not null check (status in ('watching', 'watched', 'watchlist')),
  updated_at     timestamptz not null default now(),

  -- `nulls not distinct` (Postgres 15+) makes NULL = NULL for uniqueness.
  -- Default Postgres treats NULLs as distinct, which would let a user have
  -- two "whole show" rows for the same show (both have season_number = NULL,
  -- both pass the unique check). NOT what we want.
  unique nulls not distinct (user_id, tmdb_show_id, season_number, episode_number)
);

create trigger set_watch_status_updated_at
  before update on public.watch_status
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 5. ratings — half-star numeric rating, scoped show/season/episode
-- -----------------------------------------------------------------------------
create table public.ratings (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references public.profiles(id) on delete cascade,
  tmdb_show_id   int         not null,
  season_number  int,
  episode_number int,

  -- numeric(2,1) = max 2 digits total, 1 decimal place (so range is 0.0..9.9).
  -- We pin to half-stars 0.5..5.0 with an explicit IN-list — easier to read
  -- than `score * 2 = floor(score * 2)` and self-documents the allowed set.
  score          numeric(2,1) not null check (
    score in (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0)
  ),
  created_at     timestamptz not null default now(),

  unique nulls not distinct (user_id, tmdb_show_id, season_number, episode_number)
);

-- Show detail pages aggregate ratings by tmdb_show_id (avg, count). Index it.
create index ratings_show_idx on public.ratings (tmdb_show_id);


-- -----------------------------------------------------------------------------
-- 6. reviews — text review, scoped show/season/episode
-- -----------------------------------------------------------------------------
-- Note: NO unique constraint on (user, scope). A user can post multiple
-- reviews for the same show — e.g., a rewatch years later. Letterboxd allows
-- this and the UX is nicer for it.
create table public.reviews (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  tmdb_show_id      int         not null,
  season_number     int,
  episode_number    int,
  body              text        not null check (length(body) > 0),
  contains_spoilers boolean     not null default false,
  created_at        timestamptz not null default now()
);

-- The hot query on a show detail page: "newest reviews for this show".
-- Composite index with the timestamp in DESC order serves it without a sort.
create index reviews_show_recent_idx on public.reviews (tmdb_show_id, created_at desc);

-- The hot query on a profile / activity feed: "this user's newest reviews".
create index reviews_user_recent_idx on public.reviews (user_id, created_at desc);


-- -----------------------------------------------------------------------------
-- 7. review_likes — many-to-many between users and reviews
-- -----------------------------------------------------------------------------
create table public.review_likes (
  review_id  uuid        not null references public.reviews(id)  on delete cascade,
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- PK indexes (review_id, user_id) — fast for "likes on this review".
-- Add a reverse index for "reviews this user has liked".
create index review_likes_user_idx on public.review_likes (user_id);


-- -----------------------------------------------------------------------------
-- 8. lists + list_items — user-curated collections
-- -----------------------------------------------------------------------------
create table public.lists (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  title       text        not null check (length(title) > 0),
  description text,
  is_ranked   boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- A show can appear in many lists, but only once per list. PK enforces that.
-- `position` is the order within a ranked list (or insertion order otherwise).
-- We deliberately DON'T add UNIQUE(list_id, position) — during drag-reorder
-- the client may temporarily have two items at the same position before
-- writing the final order.
create table public.list_items (
  list_id      uuid        not null references public.lists(id) on delete cascade,
  tmdb_show_id int         not null,
  position     int         not null,
  added_at     timestamptz not null default now(),
  primary key (list_id, tmdb_show_id)
);


-- -----------------------------------------------------------------------------
-- 9. shows_cache — local copy of TMDb data for curated shows
-- -----------------------------------------------------------------------------
-- We store the whole TMDb detail blob in `payload`. For ~200 popular shows
-- this is a few MB — trivially small. The Edge Function refreshes any row
-- older than N days when it's read.
--
-- Why jsonb (not json):
--   jsonb is parsed once on insert and stored as a binary tree, so reads
--   are fast and you can index inside it. `json` re-parses on every read.
create table public.shows_cache (
  tmdb_show_id int         primary key,
  payload      jsonb       not null,
  is_popular   boolean     not null default false,
  fetched_at   timestamptz not null default now()
);

-- Partial index: only popular rows are shelf-eligible, so we only index
-- those. Smaller index, faster scan for the Home query.
create index shows_cache_popular_idx
  on public.shows_cache (fetched_at desc)
  where is_popular;


-- =============================================================================
-- 10. Row-Level Security (RLS)
-- =============================================================================
-- RLS is a per-row access gate at the database level. The flow:
--   1. enable RLS on the table -> every query is now denied by default.
--   2. add policies -> each policy that matches grants access. Policies are
--      additive (UNION-style), not subtractive.
--   3. the service_role key (used by Edge Functions) bypasses RLS entirely,
--      which is why writes to shows_cache happen only from the function.
--
-- `auth.uid()` is a Supabase helper that returns the current user's UUID
-- from the JWT, or NULL for anonymous requests.

alter table public.profiles      enable row level security;
alter table public.follows       enable row level security;
alter table public.watch_status  enable row level security;
alter table public.ratings       enable row level security;
alter table public.reviews       enable row level security;
alter table public.review_likes  enable row level security;
alter table public.lists         enable row level security;
alter table public.list_items    enable row level security;
alter table public.shows_cache   enable row level security;


-- profiles: anyone can read; user can update only their own row.
-- (We don't allow INSERT/DELETE from clients — INSERTs come from the
-- handle_new_user trigger, DELETEs come from auth.users cascade.)
create policy profiles_select_all on public.profiles
  for select using (true);

create policy profiles_update_own on public.profiles
  for update
  using      (auth.uid() = id)
  with check (auth.uid() = id);


-- follows: anyone can read the graph; user can add/remove only their own edges.
create policy follows_select_all on public.follows
  for select using (true);

create policy follows_insert_own on public.follows
  for insert with check (auth.uid() = follower_id);

create policy follows_delete_own on public.follows
  for delete using (auth.uid() = follower_id);


-- ----- "read public, write only own" policies repeated per table -----
-- Postgres policies don't compose, so we copy-paste the shape. Worth a
-- helper later if this multiplies; for v1 the duplication is fine.

-- watch_status
create policy watch_status_select_all on public.watch_status
  for select using (true);
create policy watch_status_insert_own on public.watch_status
  for insert with check (auth.uid() = user_id);
create policy watch_status_update_own on public.watch_status
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy watch_status_delete_own on public.watch_status
  for delete using (auth.uid() = user_id);

-- ratings
create policy ratings_select_all on public.ratings
  for select using (true);
create policy ratings_insert_own on public.ratings
  for insert with check (auth.uid() = user_id);
create policy ratings_update_own on public.ratings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy ratings_delete_own on public.ratings
  for delete using (auth.uid() = user_id);

-- reviews
create policy reviews_select_all on public.reviews
  for select using (true);
create policy reviews_insert_own on public.reviews
  for insert with check (auth.uid() = user_id);
create policy reviews_update_own on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reviews_delete_own on public.reviews
  for delete using (auth.uid() = user_id);

-- review_likes
create policy review_likes_select_all on public.review_likes
  for select using (true);
create policy review_likes_insert_own on public.review_likes
  for insert with check (auth.uid() = user_id);
create policy review_likes_delete_own on public.review_likes
  for delete using (auth.uid() = user_id);

-- lists
create policy lists_select_all on public.lists
  for select using (true);
create policy lists_insert_own on public.lists
  for insert with check (auth.uid() = user_id);
create policy lists_update_own on public.lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy lists_delete_own on public.lists
  for delete using (auth.uid() = user_id);

-- list_items: ownership lives on the parent list, not the row itself.
-- The subquery checks "does the caller own the list this item belongs to?"
create policy list_items_select_all on public.list_items
  for select using (true);
create policy list_items_insert_own on public.list_items
  for insert with check (
    exists (select 1 from public.lists l
            where l.id = list_id and l.user_id = auth.uid())
  );
create policy list_items_update_own on public.list_items
  for update using (
    exists (select 1 from public.lists l
            where l.id = list_id and l.user_id = auth.uid())
  );
create policy list_items_delete_own on public.list_items
  for delete using (
    exists (select 1 from public.lists l
            where l.id = list_id and l.user_id = auth.uid())
  );


-- shows_cache: read-only to clients. No INSERT/UPDATE/DELETE policy exists,
-- so any non-service-role write is silently denied. The seed script and the
-- get-show / refresh-popular Edge Functions use the service-role key, which
-- bypasses RLS and can write.
create policy shows_cache_select_all on public.shows_cache
  for select using (true);
