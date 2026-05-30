# HANDOFF — Pilot current state

_Snapshot as of 2026-05-30. **Current state only** — durable architecture rules live in `CLAUDE.md`._

## Built & working

**Screens** (`src/app/`)
- **Home** (`index.tsx`) — two poster shelves from `get-popular`, FAB, bottom nav.
- **Show Detail** (`show/[id]/index.tsx`) — poster hero, kicker, title, creator, stat row, UserRatingCard, Reviews tab (real reviews via `get-reviews`), action-sheet trigger (the check bubble in the nav row).
- **Seasons** (`show/[id]/seasons.tsx`) — season pills + episode list with working watched toggles.
- **Review composer** (`show/[id]/review.tsx`) — scope selector (show / season / episode) + drag rating + body + spoiler toggle. "Review or log".
- **Auth** — landing (`(auth)/index.tsx`), signup (`(auth)/signup.tsx`), and a global login sheet.
- **Profile** (`profile/index.tsx`) — identity (username + follower/following counts + avatar) + 4 in-place sub-tabs (**Profile · Shows · Lists · Watchlist**). Profile tab: **Top-4 favorites** (poster slots, own profile gets a purple **Edit** → `/profile/top-shows`; empty slots are tappable → editor), Currently-watching shelf, tappable Following/Followers counts (→ list pages) + a Diary link (stub). **Shows** = grid of watched shows (gold rating overlay + review badge); **Watchlist** = grid; **Lists** = the user's lists as fanned-poster `ListCard`s (own profile gets a **New list** button → `/list/new`). Gear → **Edit Profile** (`/settings`). Renders the shared **`ProfileView`** (also powers `/user/[id]`). Reads via direct client queries (`useProfile`, `useCurrentlyWatching`, `useWatchedShows`, `useWatchlist`) — no Edge Function (Profile never touches TMDb).
- **User profile** (`user/[id]/index.tsx`) — public view of another user via the shared `ProfileView` (identity, counts, their Shows/Watchlist + currently-watching). **Follow/Following** button (optimistic, gated on login). `/user/[id]/following` + `/user/[id]/followers` list pages. Anonymous-viewable; a Follow tap prompts login.
- **Search** (`search.tsx`) — search bar + sub-tabs (Shows · People · Lists). Empty query → Trending (`usePopular`/`get-popular`). Debounced (300ms) live search: Shows via `search-shows` (TMDb `/search/tv` proxy), People via direct `profiles` ilike. Tap a show → `/show/[id]` (uncached shows lazily cache via `get-show`). People rows tap → `/user/[id]`. Lists tab = Coming Soon. Anonymous-safe.
- **Settings / Edit Profile** (`settings.tsx`) — tappable avatar (image picker → Supabase Storage, optimistic + rollback), **disabled** username, editable display name + bio (160-char cap + counter), "Update profile" (dirty-check), and **Sign out** (moved here from the Profile gear sheet). Reached via the Profile gear.
- **Top-4 favorites** (`profile/top-shows.tsx`) — own-only edit screen: a removable staged list (add-order, slot 1 = first added) + the reused show-search picker, capped at 4. Save → replaces `profile_top_shows` rows. Display lives in `ProfileView`: filled `Poster` slots vs tappable `DashedSlot`s; another user's profile shows their favorites read-only (hidden if none). **Order = add-order; no reorder UI** (remove + re-add to change).
- **Lists** — **New list** (`list/new.tsx`): title (required) + description + a show picker (reuses `search-shows` + debounce; `+` to stage, removable), Create → `router.replace('/list/[id]')`. Pre-stages a show passed via `?showId` (from the action sheet). **List detail** (`list/[id]/index.tsx`): title, "by {owner}", description, count, `PosterGrid` of the shows; owner sees **Delete** (confirm → cascade). All lists are public-read; plain insertion order (`position` then `added_at`, stable across refetches; `is_ranked` unused).

**Mutations** (`src/api/`) — all follow the canonical pattern in CLAUDE.md
- `useToggleEpisodeWatched` — episode watched on/off (Seasons screen).
- `useSetWatchStatus` — show-scope watched / watching / watchlist (action sheet pills).
- `useRate` — **scoped** rating (show / season / episode) via the drag picker, half-stars.
- `usePostReview` — review INSERT (text only; the rating goes through `useRate`).
- `useFollow` — asymmetric follow/unfollow toggle + follow-state; optimistic (flips follow-state + the followee's follower count + my following count).
- `useUpdateProfile` — own `display_name` / `bio` / `avatar_url`; optimistic + **broad** invalidation (avatar + name render under many keys: `['profile']`, `['reviews']`, `['searchPeople']`, `['followList']`, `['showViewers']`, `['show']`). Avatar bytes via `lib/uploadAvatar` (base64 → ArrayBuffer → Storage upsert, cache-busted URL, no orphans).
- **Lists** (`useListMutations.ts`): `useCreateList` (insert `lists` + bulk `list_items` at `position=index`), `useDeleteList` (cascade), `useListItemMutations` (`add` at max+1 / `remove`). Reads in `useLists.ts`: `useMyLists(userId)` (`['lists', userId]`) + `useList(listId)` (`['list', listId]`), both ordered `position, added_at`. The **AddToListSheet** toggle is optimistic (local membership `Set`, instant check flip, rollback on failure).

**Edge Functions** (`supabase/functions/`) — `get-show`, `get-popular`, `refresh-popular`, `get-reviews`, `search-shows`.

**Supabase Storage** — `avatars` bucket (public read; write only your own `{user_id}/…` folder, RLS-verified). Profile avatars live here; `profiles.avatar_url` stores the cache-busted public URL.

**Core flows that work**: browse anonymously → show detail → action sheet (status pills + drag-to-rate) → review composer; episode watched toggles persist; per-action login gate (browse free, login prompted on first write); ratings + reviews round-trip and survive sign-out/sign-in.

## Deploy status

All Edge Functions are deployed. `get-reviews` (2026-05-28) and `search-shows` (2026-05-30) verified live — `search-shows?query=stranger` returns mapped results; the uncached-show path is confirmed (tapping a search result for a never-cached show, e.g. 224263, triggers `get-show` to fetch + cache it with `is_popular=false`).

**⚠️ Migrations are applied MANUALLY** via the Supabase SQL editor — NOT `supabase db push` (0001 was applied out-of-band, so push would try to re-run it and fail). New migration files are version-control + paste-into-the-editor. Latest applied: `0002_profile_bio_and_avatars.sql` (`profiles.bio` with a ≤160 check + the `avatars` bucket & RLS policies). **⏳ Pending apply: `0003_profile_top_shows.sql`** (the Top-4 favorites table + RLS) — the app degrades gracefully until it's applied (empty Top-4, no crash), but favorites can't be saved/read until you paste it into the SQL editor.

> Fixed on deploy: the embed `profiles(...)` was ambiguous (PGRST201) because `review_likes.user_id` adds a second reviews→profiles path. Pinned to the author with `profiles!reviews_user_id_fkey`. Also fixed the catch block that reported `"unknown"` for PostgREST errors (plain objects, not `Error` instances) — it now surfaces `.message`.

## Mocked / stubbed
- `MOCK_FRIENDS` — Home's "New From Friends" row (`src/app/index.tsx`).
- **Diary** is a Coming Soon stub. (Following/Followers are real list pages; **Lists** and **Top-4 favorites** are now live.)
- Review **likes & comments** — `ReviewRow` shows a passive like count only; no like toggle or comment system yet (the `review_likes` table exists, unused by UI). The fake "Comment" button was removed.

  _(Spoiler enforcement is **done** — `ReviewRow` now hides a spoiler-tagged body behind a tap-to-reveal; no longer just stored-and-ignored.)_

## Routes that 404 if tapped
- Bottom nav: **Activity, Log**.
- Show Detail tabs: **Overview, Lists** (these are the show-detail *content* tabs — unrelated to user lists, which now work via the action sheet + profile).

## What's next (priority order)
1. **Lists follow-ups** (deferred from the Lists build, none blocking):
   - **Episode/season-scoped list items** (requested 2026-05-30) — today `list_items` is keyed `(list_id, tmdb_show_id)` → whole-show only. To list episodes/seasons it needs the polymorphic scope the other social tables already use: add nullable `season_number` / `episode_number` + swap the PK to `UNIQUE NULLS NOT DISTINCT (list_id, tmdb_show_id, season_number, episode_number)` (same trick as `ratings`/`reviews`/`watch_status`). Plus: picker drill-down (show → season → episode), episode/season render variants on the detail screen, and the JS scope-merge rule. Migration + UI; clean but its own task.
   - rename/edit a list after creation; reorder + ranked lists (`is_ranked` column exists, unused); public/private (would be Pilot's first private data — needs a column + read-scoping RLS); the **Search screen's Lists sub-tab** (list *search* — distinct from owning lists; still Coming Soon).

## Reviews — deferred follow-ups
- **Edit / delete your own review** — the `⋯` menu on `ReviewRow` is inert. Reviews are INSERT (multiple per scope, by design), so without delete a typo is permanent and dupes accumulate. Small build: dots → action sheet (Edit / Delete on your own rows, Report on others). _Deliberately deferred so Profile isn't delayed — it guards against typos no real user has made yet._
- **Likes + comments** — wire a `review_likes` toggle and a comment system; belongs with the social/Activity build.
- **See-all + popularity sort + pagination** — `get-reviews` returns every review newest-first, unbounded; the "Reviews" header is just a label. Fine at low volume; revisit when a show has hundreds.

## Profile — deferred follow-ups
- **Top-4 favorites — built** (`/profile/top-shows`). Order is add-order; **reorder via up/down arrows is deferred** to post-TestFlight only if users ask (never drag). Other-user Top-4 is a plain read-only poster row.
- **Diary** — still a Coming Soon stub: chronological, date-grouped watch log (`watch_status` by `updated_at`, no schema change). _(Following/Followers list pages, the `/user/[id]` profile, and Follow are now built.)_
- **Lists tab** — **built** (create / view / delete / add-from-show-detail). Remaining list polish is in "What's next" above (rename, reorder/ranked, private, list search).
- **"Watched show" definition — resolved (broad).** The Shows grid includes a show if it has a show-scope `watched` status **OR** a show-scope rating **OR** any watched episode (trust the user to curate). The gold star overlay comes only from a show-scope rating — episode ratings are NOT aggregated into a show rating. Currently-watching stays strict (show-scope `watching` only). Principle recorded in `CLAUDE.md` → "Aggregation: episode-aware schema, show-level UI".

## Trending ranking — future direction
- **Trending is currently TMDb `is_popular`** (`useTrendingShows` → `shows_cache`). Eventually switch to **app-activity ranking** — recent ratings / reviews / watchlist-adds, recency-decayed — while keeping `useTrendingShows` as the stable interface so callers (Home + Search) don't change. Blend with TMDb-popularity as backfill. **Trigger:** enough active users that aggregate activity is real signal — not before.

## Known issues (deferred LOW from the code review — also in `tasks/lessons.md`)
- _(Resolved: the stray `console.log`s in `ShowNavRow` + `seasons.tsx` were removed while fixing the nav-bubble bug. The `console.error` in mutation hooks are intentional error logging — keep those.)_
- **`pointerEvents` as a prop** (deprecated RN form): `src/components/Stars.tsx:64`, `src/components/FAB.tsx:11`.
- **`LoginSheet` lacks `KeyboardAvoidingView`** → on Android the soft keyboard covers the Log in button.
- **`src/app/show/[id]/seasons.tsx:79`** hardcodes `reviews: 248` for the tab chip (Show Detail uses the real count; Seasons doesn't — they disagree).
- **Home hamburger** (`src/app/index.tsx`) has no `onPress` — tappable but inert.
- **No NaN guard on `tmdbShowId`** in `/show/[id]` routes — a bad deep link makes `Number(id)` NaN and the queryKey / writes go sideways.
- **`get-popular` is now unused by the app.** It returned the FULL payload blob per show (~16MB for 20 shows, HTTP 500 at `limit=50`), so **both Home and Search read `shows_cache` directly via the slim `useTrendingShows` query** (selects only `payload->>name/poster_path`, ~2.5KB). The `get-popular` Edge Function is still deployed (`refresh-popular` maintains the `is_popular` flags) but has no client caller — candidate for removal or slimming later. The old `usePopular` client hook was deleted.
