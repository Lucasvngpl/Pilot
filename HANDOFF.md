# HANDOFF — Pilot current state

_Snapshot as of 2026-06-10. **Current state only** — durable architecture rules live in `CLAUDE.md`._

---

## ⭐ Latest session (2026-06-10) — Lists overhaul · social (likes + activity) · bulk-mark · feedback

> This block is the freshest state. Where the older sections below conflict with it
> (e.g. "Activity is Friends-only", "review likes are passive", "migrations applied
> manually via the SQL editor"), **this block wins.**

**Shipped & committed (on `main`, through commit `ad00cb2` + two follow-ups):**
- **Lists now hold all 3 scopes.** New search-first **add-item picker** (`ListItemPicker`):
  tap a result = add the whole show; the `›` chevron drills **show → seasons → episodes**
  to add at any scope. Two-state **○→✓ add indicator** (extracted to `src/components/AddIndicator.tsx`,
  reused by bulk-mark). One picker for list **create + edit**. (Closes the long-standing
  "episode/season-scoped list items" gap; scope columns were already in migration `0009`.)
- **List detail rows** lead with the **show name** + a scope subtitle (was scope-only — you
  couldn't tell which show an episode belonged to). `ListShowItem.showName` added.
- **Custom list banner** — owner picks a TMDb **backdrop** (a show in the list or any searched
  show) via `ListBannerPicker`; stored as `lists.banner_backdrop_path` (migration **`0012`**).
- **List drafts** — composer has **Save draft / Publish** (`lists.is_draft`, migration **`0014`**;
  title check relaxed so drafts can be untitled). Filtered out of every public list read
  (`useMyLists`/`useShowLists`/activity); surfaced own-only in **Profile › Drafts** alongside
  review drafts (`useDraftLists`). Mirrors the review-draft system.
- **Drag-to-reorder** list-editor rows (☰ grip, `react-native-draglist`) — replaced the ↑/↓ arrows.
- **ListCard**: scope-aware count ("5 seasons", not "5 shows" — `listCountLabel`) + fixed-width
  poster cluster so all titles align.
- **Likes are interactive** (reviews **and** lists) and now have a record: **Profile › My record
  → Likes** (`/profile/likes`, own-only, `useMyLikes`). Unliking removes the row **instantly**
  from the Likes page + the You feed (optimistic, in `useLikes`).
- **Activity = Friends + You tabs** (`useActivityFeed('friends' | 'you')`), and the feed now
  includes **like + follow** events (not just watched/watchlist/review/list). Migration **`0013`**
  (reverse indexes on the like tables). _(Incoming tab still deferred.)_
- **app-store-review skill** vendored into `.claude/skills/` (Expo/RN App Store guideline checker;
  relevant to the UGC-moderation public-launch gate).

**Built but ⏳ UNCOMMITTED + pending your on-device verification:**
- **Bulk mark-watched** — Settings → **"Mark shows watched"** (`/profile/bulk-watched`): search-first
  multi-select → ONE batched **`bulk_mark_watched` RPC** (migration **`0015`**). Backlog rows store
  `from_backlog=true`, `watched_at=NULL` → they **fill the Shows→Watched grid but are excluded from
  the Diary AND all time-based stats** (`useDiary` filters `from_backlog=false`; rule recorded in
  CLAUDE.md). The RPC is **non-destructive** — on conflict it updates STATUS ONLY (never nulls a real
  date). **Device checks:** (a) marked shows appear in Shows, NOT the Diary; (b) **the bug-catch case** —
  bulk-mark a show you'd already logged with a real date → it keeps its original Diary date.
- **Send feedback** — Settings → **"Send feedback"** → in-app composer (`expo-mail-composer`) to
  **lucas.venugopal.dev@gmail.com** with a version/OS line; mailto → address-alert fallbacks
  (`src/lib/feedback.ts`). **⚠️ Needs a dev-client rebuild** (`npx expo run:ios`) — the native module
  isn't in the currently-installed build.

**Workflow / infra:**
- **Migrations now run via the Supabase MCP** (`apply_migration`) — NOT hand-pasted. `0012`–`0015`
  are **applied live on the remote project**; `.sql` files are committed under `supabase/migrations/`.
  (Connect with: `claude mcp add supabase --env SUPABASE_ACCESS_TOKEN=<PAT> -- npx -y
  @supabase/mcp-server-supabase@latest --project-ref=hhpczdqpfbcoamayrbtx --features=database`,
  then restart Claude Code.)
- Stray `.DS_Store` files show as untracked → add to `.gitignore` (don't commit them).

**Known blockers / env:**
- **iOS device won't launch** ("profile not trusted"): on the phone → **Settings → General → VPN &
  Device Management → Trust** the dev cert, then tap the app. (Free Apple accounts expire dev
  profiles after 7 days → rebuild.)
- The Feedback feature won't work until the dev-client rebuild above.

**Suggested next** (from the roadmap chat): the **sharing loop** (a shareable taste/review **card**
+ a working public web landing — the flagged growth engine; today sharing is just a text link to a
placeholder URL), **or Report + Block** (the App-Store 1.2 gate that also unblocks comments), **or**
the **Incoming** activity tab. Bulk-mark v2 = a browseable **popular/trending grid** (recognition,
not recall — what actually delivers "clear hundreds fast").

---

## Built & working

**Theming (light + dark)** — full dark mode shipped. Every screen/sheet reads the active palette at render via `useThemedStyles`/`useTheme` (`src/lib/theme.tsx`); `src/theme.ts` holds `lightColors`/`darkColors`. Default follows the OS (`useColorScheme`); manual override (light/dark/**system**) persists in AsyncStorage (`pilot.themePref.v1`). Header **sun/moon** toggle (left of the Profile gear) = 2-way live flip; **Settings › Appearance** = 3-way. Global `<StatusBar>` flips content color with the mode; the list + review hero banners stay dark in both modes (`bannerInk`). See CLAUDE.md "Theme system" for the token-role rules. Deferred: per-screen exceptions, themed illustrations, AMOLED true-black.

**Screens** (`src/app/`)
- **Home** (`index.tsx`) — centered **PILOT** wordmark (ArchivoBlack 20 / tracking 3, matching the auth screen), no hamburger. "Popular on TV" (TMDb trending) + "New From Friends" (real `useActivityFeed`, empty-prompt → `/search?tab=people`). Two entry points to the same log/list `ActionMenuSheet` (kept redundant by choice): the bottom-nav **Log "+"** tab (the menu lives in `BottomNav`, so it works on every screen) **and** the purple **FAB** on Home. Actions: **Review or log** → `/search?log=1` (taps route straight to the composer) · **New list** → `/list/new`.
- **Show Detail** — four tab routes that `replace` each other instantly (no slide; `Tabs.tsx` + `animation:'none'` in `_layout`). Order **Overview · Seasons · Reviews · Lists**, all real-count badges. **Overview** is the LANDING (`show/[id]/index.tsx`): poster hero (title 34px, content rating in the meta line) + UserRatingCard, then an info table (Status · Aired range · Available-on streaming logos · **Awards** from OMDb), Summary, and the full **Cast** grid (TMDb credits). **Reviews** (`show/[id]/reviews.tsx`): the reviews list + own-review Edit/Delete. **Lists** (`show/[id]/lists.tsx`): public lists containing the show (`useShowLists`, filtered `is_public=true`) → `/list/[id]`; empty state otherwise. The secondary tabs share `ShowCompactHeader`.
- **Seasons** (`show/[id]/seasons.tsx`) — season pills + episode list with working watched toggles (now uses the shared `ShowCompactHeader` + real tab counts).
- **Review composer** (`show/[id]/review.tsx`) — scope selector (show / season / episode) + drag rating + body + spoiler toggle. "Review or log".
- **Auth** — landing (`(auth)/index.tsx`), signup (`(auth)/signup.tsx`), and a global login sheet.
- **Profile** (`profile/index.tsx`) — identity (username + follower/following counts + avatar) + 4 in-place sub-tabs (**Profile · Shows · Lists · Watchlist**). Profile tab: **Top-4 favorites** (poster slots, own profile gets a purple **Edit** → `/profile/top-shows`; empty slots are tappable → editor), Currently-watching shelf, tappable Following/Followers counts (→ list pages) + a **Diary** link (→ `/profile/diary`). **Shows** = grid of watched shows (gold rating overlay + review badge); **Watchlist** = grid; **Lists** = the user's lists as fanned-poster `ListCard`s (own profile gets a **New list** button → `/list/new`). Gear → **Edit Profile** (`/settings`). Renders the shared **`ProfileView`** (also powers `/user/[id]`). Reads via direct client queries (`useProfile`, `useCurrentlyWatching`, `useWatchedShows`, `useWatchlist`) — no Edge Function (Profile never touches TMDb).
- **User profile** (`user/[id]/index.tsx`) — public view of another user via the shared `ProfileView` (identity, counts, their Shows/Watchlist + currently-watching). **Follow/Following** button (optimistic, gated on login). `/user/[id]/following` + `/user/[id]/followers` list pages. Anonymous-viewable; a Follow tap prompts login.
- **Search** (`search.tsx`) — search bar + sub-tabs (Shows · People · Lists). Empty query → Trending (`usePopular`/`get-popular`). Debounced (300ms) live search: Shows via `search-shows` (TMDb `/search/tv` proxy), People via direct `profiles` ilike. Tap a show → `/show/[id]` (uncached shows lazily cache via `get-show`). People rows tap → `/user/[id]`. Lists tab = Coming Soon. Anonymous-safe.
- **Settings / Edit Profile** (`settings.tsx`) — tappable avatar (image picker → Supabase Storage, optimistic + rollback), **editable username** (format `[a-zA-Z0-9_]{3,20}`, validated only when changed so grandfathered dotted handles still save; case-insensitive uniqueness via the `lower(username)` index → friendly "taken" on `23505`), editable display name + bio (160-char cap + counter), "Update profile" (dirty-check), and **Sign out**. Reached via the Profile gear. New signups get a random `user_<id8>` handle + null display name (no email-derived PII; the trigger change in `0005` affects **new signups only** — existing handles unchanged until edited).
- **Activity → Friends feed** (`activity.tsx`, the bottom-nav Activity tab) — a time-ordered stream of what people you follow did: **watched** a show (show-scope only, + their rating), **added to watchlist** (compact row), **reviewed** (poster + stars + body snippet, spoiler-hidden), or **created a list** (title + poster strip). `useActivityFeed` reads `follows` → merges `watch_status`/`reviews`/`lists` for followees, enriches profiles/cards/ratings/list-previews, sorts newest-first (cap 40). Direct client reads. Relative time via `lib/timeAgo`. Empty when you follow nobody. **Only the Friends feed** — no You/Incoming tabs yet (so no dead tabs).
- **Diary** (`profile/diary.tsx`) — own-only, date-grouped log of every **watched event** (whole-show / season / episode), newest first. Month bands → Letterboxd-style rows (date cell · poster · title+year · scope line · scoped stars + review marker), tap → `/show/[id]`. `useDiary` reads `watch_status` (`status=watched`) and merges the year (`shows_cache`) + the rating/review for each event's **exact scope** in JS (string scope-key, never a SQL join). Event-level by design — does NOT aggregate to the show like the Profile grids do.
- **Top-4 favorites** (`profile/top-shows.tsx`) — own-only edit screen: a removable staged list (add-order, slot 1 = first added) + the reused show-search picker, capped at 4. Save → replaces `profile_top_shows` rows. Display lives in `ProfileView`: filled `Poster` slots vs tappable `DashedSlot`s; another user's profile shows their favorites read-only (hidden if none). **Order = add-order; no reorder UI** (remove + re-add to change).
- **Lists** — **New list** (`list/new.tsx`): title (required) + description + a show picker (reuses `search-shows` + debounce; `+` to stage, removable), Create → `router.replace('/list/[id]')`. Pre-stages a show passed via `?showId` (from the action sheet). **List detail** (`list/[id]/index.tsx`): title, "by {owner}", description, count, `PosterGrid` of the shows; owner sees **Delete** (confirm → cascade). All lists are public-read; plain insertion order (`position` then `added_at`, stable across refetches; `is_ranked` unused).

**Mutations** (`src/api/`) — all follow the canonical pattern in CLAUDE.md
- `useToggleEpisodeWatched` — episode watched on/off (Seasons screen).
- `useSetWatchStatus` — show-scope watched / watching / watchlist (action sheet pills).
- `useRate` — **scoped** rating (show / season / episode) via the drag picker, half-stars.
- `usePostReview` — review INSERT (text only; the rating goes through `useRate`).
- `useFollow` — asymmetric follow/unfollow toggle + follow-state; optimistic (flips follow-state + the followee's follower count + my following count).
- `useUpdateProfile` — own `display_name` / `bio` / `avatar_url`; optimistic + **broad** invalidation (avatar + name render under many keys: `['profile']`, `['reviews']`, `['searchPeople']`, `['followList']`, `['showViewers']`, `['show']`). Avatar bytes via `lib/uploadAvatar` (base64 → ArrayBuffer → Storage upsert, cache-busted URL, no orphans).
- **Lists** (`useListMutations.ts`): `useCreateList` (insert `lists` + bulk `list_items` at `position=index`), `useUpdateList` (title/description), `useDeleteList` (cascade), `useListItemMutations` (`add` at max+1 / `remove`). Reads in `useLists.ts`: `useMyLists(userId)` (`['lists', userId]`) + `useList(listId)` (`['list', listId]`), both ordered `position, added_at`. The **AddToListSheet** toggle is optimistic (local membership `Set`, instant check flip, rollback on failure). Edit reuses `/list/new?edit=` (set-difference item reconcile).
- **Reviews** (`useReviewMutations.ts`): `useUpdateReview` (body/spoiler) + `useDeleteReview` (by id) — both invalidate `['reviews']`/`['show']`/`['watched']`. `usePostReview` still does the INSERT. Edit reuses the composer (`review.tsx?reviewId=`, scope locked); the `⋯` menu (owner-only) is the shared `ActionMenuSheet`.

**Edge Functions** (`supabase/functions/`) — `get-show`, `get-popular`, `refresh-popular`, `get-reviews`, `search-shows`, `get-person` (actor pages → `usePerson`).

**Supabase Storage** — `avatars` bucket (public read; write only your own `{user_id}/…` folder, RLS-verified). Profile avatars live here; `profiles.avatar_url` stores the cache-busted public URL.

**Core flows that work**: browse anonymously → show detail → action sheet (status pills + drag-to-rate) → review composer; episode watched toggles persist; per-action login gate (browse free, login prompted on first write); ratings + reviews round-trip and survive sign-out/sign-in.

## Deploy status

All Edge Functions are deployed. `get-reviews` (2026-05-28) and `search-shows` (2026-05-30) verified live — `search-shows?query=stranger` returns mapped results; the uncached-show path is confirmed (tapping a search result for a never-cached show, e.g. 224263, triggers `get-show` to fetch + cache it with `is_popular=false`).

**🔒 Security pass (2026-05-30) — see `SECURITY_AUDIT.md`. ⏳ NOT yet deployed:** the 5 Edge Functions need a redeploy (error-message leak fix + `refresh-popular` fail-closed gate + `search-shows` query cap), `CRON_SECRET` must be set, and migration `0004` applied. Full checklist in `SECURITY_AUDIT.md` → "MUST DO before launch".

**Name model (2026-05-31):** `display_name` is the shown name, `@username` the handle; UI shows `display_name ?? username` (Profile, reviews, activity, people/follow rows). Client spots are live; **review names need `get-reviews` redeployed** (it now also embeds `display_name`) — until then reviews show the `@handle`.

**⚠️ Migrations are applied MANUALLY** via the Supabase SQL editor — NOT `supabase db push` (0001 was applied out-of-band, so push would try to re-run it and fail). New migration files are version-control + paste-into-the-editor. Applied: `0002_profile_bio_and_avatars.sql` (bio + avatars) and `0003_profile_top_shows.sql` (Top-4 table + RLS — verified live). **⏳ Pending apply: `0004_security_hardening.sql`** (`list_items` UPDATE `WITH CHECK` + scope-integrity CHECKs), **`0005_username.sql`** (random default handle + `lower(username)` unique index — username editing), **and `0006_schedule_refresh_popular.sql`** (pg_cron daily `refresh-popular` — needs `CRON_SECRET` set + a matching Vault secret + the `refresh-popular` redeploy first; runbook in the file header).

**Review drafts (2026-06-01) — ⏳ NOT yet applied/deployed:** migration **`0007_review_drafts.sql`** adds `reviews.is_draft` + relaxes the body CHECK to `is_draft OR length(body) > 0`. **Apply it first**, then **redeploy `get-reviews` AND `get-show`** (both now add `.eq('is_draft', false)`). The **`get-reviews` redeploy is MANDATORY** — without it, drafts leak into the public show Reviews tab. Client reads already filter in-app. RLS is unchanged: drafts are filtered at the query level, so `useDraftReviews` (is_draft=true) must ONLY run for the signed-in user — it's gated own-only in `ProfileView` + the `/profile/drafts` screen. Publishing is **one-way** (a published review can be edited, not reverted to draft).

> Fixed on deploy: the embed `profiles(...)` was ambiguous (PGRST201) because `review_likes.user_id` adds a second reviews→profiles path. Pinned to the author with `profiles!reviews_user_id_fkey`. Also fixed the catch block that reported `"unknown"` for PostgREST errors (plain objects, not `Error` instances) — it now surfaces `.message`.

## Mocked / stubbed
- _(Resolved: Home's "New From Friends" row was `MOCK_FRIENDS` — now real `useActivityFeed` watched/reviewed events from followees, deduped to one tile per show, with a "Follow people…" empty state → `/search?tab=people`. Home title relabeled "Discover"; the trending shelf is "Popular on TV" — both honest about being TMDb world-popularity, not in-app activity.)_
- (Following/Followers are real list pages; **Lists**, **Top-4 favorites**, and **Diary** are now live.)
- Review **likes & comments** — `ReviewRow` shows a passive like count only; no like toggle or comment system yet (the `review_likes` table exists, unused by UI). The fake "Comment" button was removed.

  _(Spoiler enforcement is **done** — `ReviewRow` now hides a spoiler-tagged body behind a tap-to-reveal; no longer just stored-and-ignored.)_

## Routes that 404 if tapped
- _(Bottom nav: all five tabs now work — Activity → Friends feed, Log → the "+" log/list menu.)_
- Show Detail tabs: **Overview, Lists** (these are the show-detail *content* tabs — unrelated to user lists, which now work via the action sheet + profile).

## What's next (priority order)
1. **Lists follow-ups** (deferred from the Lists build, none blocking):
   - **Episode/season-scoped list items** (requested 2026-05-30) — today `list_items` is keyed `(list_id, tmdb_show_id)` → whole-show only. To list episodes/seasons it needs the polymorphic scope the other social tables already use: add nullable `season_number` / `episode_number` + swap the PK to `UNIQUE NULLS NOT DISTINCT (list_id, tmdb_show_id, season_number, episode_number)` (same trick as `ratings`/`reviews`/`watch_status`). Plus: picker drill-down (show → season → episode), episode/season render variants on the detail screen, and the JS scope-merge rule. Migration + UI; clean but its own task.
   - reorder + ranked lists (`is_ranked` column exists, unused); public/private (would be Pilot's first private data — needs a column + read-scoping RLS); the **Search screen's Lists sub-tab** (list *search* — distinct from owning lists; still Coming Soon). _(Rename/edit a list after creation: **done** — list detail `⋯` → Edit → `/list/new?edit=`.)_

## Reviews — deferred follow-ups
- **Full single-review page — built (2026-06-01).** Tapping a review row anywhere (show Reviews tab, Profile › Reviews) opens **`/review/[id]`** — a Letterboxd-style read view: full-bleed show **backdrop** banner under the status bar (falls back to a dark block when the show has none), the **poster** (tap → `/show/[id]`), reviewer avatar + name, show name + scope, stars, "Reviewed {date}", and the **full untruncated body** (spoiler-gated if flagged). Your own review gets the banner **⋯ → Edit / Delete** (others' hide it). Data: **`useReviewDetail(reviewId)`** — one `profiles!reviews_user_id_fkey(...)` + `review_likes(count)` embed + the scope-rating JS merge + `fetchShowCards` (now also carries `backdrop_path`). **Published-only** (`.eq('is_draft', false)`) — a draft/unknown id → "Review not found"; drafts still open the **composer**, not this page (no-leak holds). The inline **"Read more"** expand inside `ReviewRow` was **retired** in favor of this page (rows stay clamped to 4 lines with the trailing "…"). Pure client reads — **no migration / Edge Function / deploy.**
- **Review drafts — built (2026-06-01).** A draft is an unpublished review (`reviews.is_draft`), filtered out of EVERY public query (get-reviews, get-show, activity, watched-grid, diary, your public Reviews). Composer has **Save draft** / **Publish** (a single **Save** when editing an already-published review — publishing is one-way). Drafts surface ONLY in **Profile › Your record → Drafts** (`/profile/drafts`, own-only, count badge); tapping one reopens the composer (loads via `useReview` by id, since get-reviews hides drafts). The rating writes publicly immediately (no draft state for ratings); only the body is held back, and empty-body (rating-only) drafts are allowed. _Deferred: reverting published → draft; draft lists; the stricter owner-only-drafts RLS (we chose query-level filtering)._
- **Edit / delete your own review — done.** The `⋯` on `ReviewRow` shows **only on your own reviews** → `ActionMenuSheet` (Edit / Delete). Edit reopens the composer (`review.tsx?reviewId=`) pre-filled with body + rating + spoiler, scope **locked** (read-only label); saves body/spoiler via `useUpdateReview` + rating via `useRate`. Delete via `useDeleteReview` (confirm). RLS (`reviews_update_own`/`delete_own`) was already there — no migration. _Still deferred: **Report** on others' reviews (the menu is owner-only for now)._
- **Likes + comments** — wire a `review_likes` toggle and a comment system; belongs with the social/Activity build.
- **See-all + popularity sort + pagination** — `get-reviews` returns every review newest-first, unbounded; the "Reviews" header is just a label. Fine at low volume; revisit when a show has hundreds.

## Profile — deferred follow-ups
- **Top-4 favorites — built** (`/profile/top-shows`). Order is add-order; **reorder via up/down arrows is deferred** to post-TestFlight only if users ask (never drag). Other-user Top-4 is a plain read-only poster row.
- **Diary — built** (`/profile/diary`): event-level watched log, month-grouped. _Inclusion rule (per CLAUDE.md's "decide it per view"): every `status=watched` row, all scopes; **not** aggregated to the show. Deferred: pagination past the newest 100; filter/sort controls._ (Following/Followers list pages, the `/user/[id]` profile, and Follow are also built.)
- **Lists tab** — **built** (create / view / delete / add-from-show-detail). Remaining list polish is in "What's next" above (rename, reorder/ranked, private, list search).
- **"Watched show" definition — resolved (broad).** The Shows grid includes a show if it has a show-scope `watched` status **OR** a show-scope rating **OR** any watched episode (trust the user to curate). The gold star overlay comes only from a show-scope rating — episode ratings are NOT aggregated into a show rating. Currently-watching stays strict (show-scope `watching` only). Principle recorded in `CLAUDE.md` → "Aggregation: episode-aware schema, show-level UI".

## Trending ranking — future direction
- **Source is TMDb `/trending/tv/week`** (was `/tv/popular`), written to `shows_cache.is_popular` by `refresh-popular`, read by `useTrendingShows`. `refresh-popular` is scheduled **daily** via pg_cron (`0006`) so the "Popular on TV" shelf stays fresh instead of being a seed-day snapshot. ⏳ Scheduling is pending the user's setup (see `0006` header: set `CRON_SECRET`, mirror it into Vault as `cron_secret`, redeploy `refresh-popular`, apply `0006`).
- **Eventually switch to app-activity ranking** — recent ratings / reviews / watchlist-adds, recency-decayed — as a **source swap behind `useTrendingShows`** (no UI change), blending TMDb as backfill. **Trigger:** enough active users that aggregate activity is real signal — not before.

## Known issues (deferred LOW from the code review — also in `tasks/lessons.md`)
- _(Resolved: the stray `console.log`s in `ShowNavRow` + `seasons.tsx` were removed while fixing the nav-bubble bug. The `console.error` in mutation hooks are intentional error logging — keep those.)_
- **`pointerEvents` as a prop** (deprecated RN form): `src/components/Stars.tsx:64`, `src/components/FAB.tsx:11`.
- **`LoginSheet` lacks `KeyboardAvoidingView`** → on Android the soft keyboard covers the Log in button.
- **`src/app/show/[id]/seasons.tsx:79`** hardcodes `reviews: 248` for the tab chip (Show Detail uses the real count; Seasons doesn't — they disagree).
- **Home hamburger** (`src/app/index.tsx`) has no `onPress` — tappable but inert.
- **No NaN guard on `tmdbShowId`** in `/show/[id]` routes — a bad deep link makes `Number(id)` NaN and the queryKey / writes go sideways.
- **`get-popular` is now unused by the app.** It returned the FULL payload blob per show (~16MB for 20 shows, HTTP 500 at `limit=50`), so **both Home and Search read `shows_cache` directly via the slim `useTrendingShows` query** (selects only `payload->>name/poster_path`, ~2.5KB). The `get-popular` Edge Function is still deployed (`refresh-popular` maintains the `is_popular` flags) but has no client caller — candidate for removal or slimming later. The old `usePopular` client hook was deleted.
