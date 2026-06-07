-- 0013_like_reverse_indexes.sql — reverse indexes on the like tables.
--
-- review_likes/list_likes PKs are (target_id, user_id), great for "likes on THIS
-- target" but useless for "everything THIS user liked" — which the new My Likes
-- record (useMyLikes) and the activity feed's like sources both do (filter by
-- user_id). Add the user_id-leading index the 0001 schema already left a TODO for.
--
-- Applied via the Supabase MCP (apply_migration). Pure perf; non-breaking.

create index if not exists review_likes_user_idx on public.review_likes (user_id);
create index if not exists list_likes_user_idx   on public.list_likes   (user_id);
