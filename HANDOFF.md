# HANDOFF — Pilot current state

_Snapshot as of 2026-05-29. **Current state only** — durable architecture rules live in `CLAUDE.md`._

## Built & working

**Screens** (`src/app/`)
- **Home** (`index.tsx`) — two poster shelves from `get-popular`, FAB, bottom nav.
- **Show Detail** (`show/[id]/index.tsx`) — poster hero, kicker, title, creator, stat row, UserRatingCard, Reviews tab (real reviews via `get-reviews`), action-sheet trigger (the check bubble in the nav row).
- **Seasons** (`show/[id]/seasons.tsx`) — season pills + episode list with working watched toggles.
- **Review composer** (`show/[id]/review.tsx`) — scope selector (show / season / episode) + drag rating + body + spoiler toggle. "Review or log".
- **Auth** — landing (`(auth)/index.tsx`), signup (`(auth)/signup.tsx`), and a global login sheet.
- **Profile** (`profile/index.tsx`) — identity (username + follower/following counts + avatar) + 4 in-place sub-tabs (**Profile · Shows · Lists · Watchlist**). Profile tab: Top-4 dashed slots, Currently-watching shelf, Diary/Following/Followers sub-page links. **Shows** = grid of watched shows (gold rating overlay + review badge); **Watchlist** = grid; **Lists** = Coming Soon. Gear → Sign-out sheet. Reads via direct client queries (`useProfile`, `useCurrentlyWatching`, `useWatchedShows`, `useWatchlist`) — no Edge Function (Profile never touches TMDb).

**Mutations** (`src/api/`) — all follow the canonical pattern in CLAUDE.md
- `useToggleEpisodeWatched` — episode watched on/off (Seasons screen).
- `useSetWatchStatus` — show-scope watched / watching / watchlist (action sheet pills).
- `useRate` — **scoped** rating (show / season / episode) via the drag picker, half-stars.
- `usePostReview` — review INSERT (text only; the rating goes through `useRate`).

**Edge Functions** (`supabase/functions/`) — `get-show`, `get-popular`, `refresh-popular`, `get-reviews`.

**Core flows that work**: browse anonymously → show detail → action sheet (status pills + drag-to-rate) → review composer; episode watched toggles persist; per-action login gate (browse free, login prompted on first write); ratings + reviews round-trip and survive sign-out/sign-in.

## Deploy status

All four Edge Functions are deployed. `get-reviews` was deployed 2026-05-28 and verified live (show 66732 returns its review enriched with profile + rating; empty shows return `{reviews: []}`).

> Fixed on deploy: the embed `profiles(...)` was ambiguous (PGRST201) because `review_likes.user_id` adds a second reviews→profiles path. Pinned to the author with `profiles!reviews_user_id_fkey`. Also fixed the catch block that reported `"unknown"` for PostgREST errors (plain objects, not `Error` instances) — it now surfaces `.message`.

## Mocked / stubbed
- `MOCK_FRIENDS` — Home's "New From Friends" row (`src/app/index.tsx`).
- Profile **Top-4** slots are display-only (no edit picker yet); the **Lists** tab + **Diary / Following / Followers** sub-pages are Coming Soon screens.
- "Add to lists…" in the action sheet → `Alert('Coming soon')`.
- Review **likes & comments** — `ReviewRow` shows a passive like count only; no like toggle or comment system yet (the `review_likes` table exists, unused by UI). The fake "Comment" button was removed.

  _(Spoiler enforcement is **done** — `ReviewRow` now hides a spoiler-tagged body behind a tap-to-reveal; no longer just stored-and-ignored.)_

## Routes that 404 if tapped
- Bottom nav: **Activity, Log, Search**.
- Show Detail tabs: **Overview, Lists**.

## What's next (priority order)
1. **Search** — find shows beyond the curated ~200 (needs a TMDb-search Edge Function path). Also unblocks the Profile Top-4 favorites picker.
2. **`useFollow` / `useUnfollow`** + the other-user profile view (asymmetric model; the `follows` table already exists). Unblocks the Following/Followers sub-pages.
3. **Lists** — create + add-to (`lists` / `list_items` tables exist; no UI yet). Unblocks the Profile Lists tab.

## Reviews — deferred follow-ups
- **Edit / delete your own review** — the `⋯` menu on `ReviewRow` is inert. Reviews are INSERT (multiple per scope, by design), so without delete a typo is permanent and dupes accumulate. Small build: dots → action sheet (Edit / Delete on your own rows, Report on others). _Deliberately deferred so Profile isn't delayed — it guards against typos no real user has made yet._
- **Likes + comments** — wire a `review_likes` toggle and a comment system; belongs with the social/Activity build.
- **See-all + popularity sort + pagination** — `get-reviews` returns every review newest-first, unbounded; the "Reviews" header is just a label. Fine at low volume; revisit when a show has hundreds.

## Profile — deferred follow-ups
- **Top-4 favorites picker** — slots render empty; selecting/reordering shows needs Search (the show picker). No "Edit" link shown until then (avoids a dead control).
- **Diary / Following / Followers** — Coming Soon stub screens. Diary = chronological, date-grouped watch log (`watch_status` by `updated_at`, no schema change). Following/Followers lists + tapping into another user's profile come with the Follow milestone.
- **Lists tab** — Coming Soon until list create / add-to UI exists.
- **"Watched show" definition — resolved (broad).** The Shows grid includes a show if it has a show-scope `watched` status **OR** a show-scope rating **OR** any watched episode (trust the user to curate). The gold star overlay comes only from a show-scope rating — episode ratings are NOT aggregated into a show rating. Currently-watching stays strict (show-scope `watching` only). Principle recorded in `CLAUDE.md` → "Aggregation: episode-aware schema, show-level UI".

## Known issues (deferred LOW from the code review — also in `tasks/lessons.md`)
- **Debug logs left in**: `src/components/ShowNavRow.tsx:32`, `src/app/show/[id]/seasons.tsx:56`. (The `console.error` in mutation hooks are intentional error logging — keep those.)
- **`pointerEvents` as a prop** (deprecated RN form): `src/components/Stars.tsx:64`, `src/components/FAB.tsx:11`.
- **`LoginSheet` lacks `KeyboardAvoidingView`** → on Android the soft keyboard covers the Log in button.
- **`src/app/show/[id]/seasons.tsx:79`** hardcodes `reviews: 248` for the tab chip (Show Detail uses the real count; Seasons doesn't — they disagree).
- **Home hamburger** (`src/app/index.tsx`) has no `onPress` — tappable but inert.
- **No NaN guard on `tmdbShowId`** in `/show/[id]` routes — a bad deep link makes `Number(id)` NaN and the queryKey / writes go sideways.
