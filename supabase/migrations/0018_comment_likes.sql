-- 0018_comment_likes.sql — likes on comments (PIL-24 follow-up).
--
-- Mirror of review_likes (0001): one row per (comment, user), composite PK so a
-- user can like a comment at most once. Public SELECT (counts are public info),
-- write only your own row. ON DELETE CASCADE on both FKs so a deleted comment or
-- a deleted user takes its likes with it.
--
-- Read path: get-comments aggregates these (one `in (...)` query per thread, not
-- per-comment) into like_count + liked_by_me on each comment. Writes go direct to
-- this table from the client (Pilot's own social data, RLS-protected).
--
-- Apply MANUALLY (this project applies migrations out-of-band, not via db push).
-- After applying, redeploy get-comments (it now reads comment_likes).
create table public.comment_likes (
  comment_id uuid        not null references public.comments(id)  on delete cascade,
  user_id    uuid        not null references public.profiles(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

-- "Which comments did this user like" + rollback-on-user-delete scans. Counts by
-- comment are already served by the PK's leading column (comment_id).
create index comment_likes_user_idx on public.comment_likes (user_id);

alter table public.comment_likes enable row level security;

-- Public read (anyone can see counts); you may only add/remove YOUR OWN like.
create policy comment_likes_select_all on public.comment_likes
  for select using (true);
create policy comment_likes_insert_own on public.comment_likes
  for insert with check (auth.uid() = user_id);
create policy comment_likes_delete_own on public.comment_likes
  for delete using (auth.uid() = user_id);
