-- 0014_list_drafts.sql — unpublished list drafts.
--
-- Mirrors reviews.is_draft (0007): a draft is own-only, filtered out of every
-- PUBLIC list query at the query level (useMyLists / useShowLists / useActivityFeed),
-- and surfaced only in Profile › Drafts. RLS is unchanged (drafts aren't hidden at
-- the DB level — the client just never queries them except own-only useDraftLists).
--
-- Untitled drafts are allowed (stash items before naming the list); a PUBLISHED
-- list still requires a title — enforced by the conditional check below.
--
-- Applied via the Supabase MCP (apply_migration). NON-BREAKING: defaults to false.

alter table public.lists add column if not exists is_draft boolean not null default false;

alter table public.lists drop constraint if exists lists_title_check;
alter table public.lists add constraint lists_title_chk check (is_draft or length(title) > 0);
