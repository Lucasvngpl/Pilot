-- 0007_review_drafts.sql — review drafts.
--
-- A draft is an UNPUBLISHED review: it exists, is editable, never appears
-- publicly, and has a "Publish" action that makes it live. This is NOT a
-- private/public visibility model — just draft vs published, so a BOOLEAN (not a
-- status enum) is the honest shape.
--
-- Apply MANUALLY in the Supabase SQL editor (this project doesn't run db push).
--
-- SECURITY — RLS is intentionally UNCHANGED. `reviews` stays public-SELECT;
-- drafts are filtered at the QUERY level in every public-facing read
-- (get-reviews, get-show, useMyReviews, useActivityFeed, useWatchedShows,
-- useDiary all add `is_draft = false`). Drafts aren't sensitive, just unfinished,
-- so query-level filtering is sufficient and simpler than an owner-only read
-- policy. The owner reads their own drafts by id (public SELECT) for editing.

alter table public.reviews
  add column if not exists is_draft boolean not null default false;

-- Supports both "exclude drafts" (public reads) and "my drafts" (own surface).
create index if not exists reviews_user_draft_idx on public.reviews (user_id, is_draft);

-- Relax the body CHECK: a DRAFT may have an empty body (you saved just a rating
-- and haven't written the text yet). A PUBLISHED review still requires text.
-- Drop the existing length>0 check by its real name (found dynamically, so this
-- doesn't depend on Postgres's auto-generated constraint name), then re-add.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.reviews'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%length(body)%';
  if c is not null then
    execute format('alter table public.reviews drop constraint %I', c);
  end if;
end $$;

alter table public.reviews
  add constraint reviews_body_check check (is_draft or length(body) > 0);
