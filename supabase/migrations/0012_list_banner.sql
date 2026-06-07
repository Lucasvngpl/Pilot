-- 0012_list_banner.sql — custom list banner (owner-picked TMDb backdrop).
--
-- Adds `banner_backdrop_path`: a TMDb backdrop PATH (e.g. "/abc.jpg"), or NULL to
-- fall back to the auto-composite of the list's posters (the default today). We
-- store a reference, not an image — no upload, no Storage, no image moderation
-- (v1 is backdrops-only; photo upload is deferred). The client builds the URL via
-- tmdbImage(); useList maps it to ListDetail.bannerUrl and ListBanner renders it
-- over the composite. Picked from a show in the list or any searched show
-- (ListBannerPicker).
--
-- Applied via the Supabase MCP (apply_migration), not by hand. NON-BREAKING:
-- nullable, defaults to the existing auto-composite behaviour. RLS unchanged.

alter table public.lists
  add column if not exists banner_backdrop_path text;
