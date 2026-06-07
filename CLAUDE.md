# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Three coexisting codebases

The repo holds three projects with different runtimes and dependency trees. The root `tsconfig.json` deliberately excludes the second two — they typecheck (or not) on their own:

- **`src/`** — Expo Router app (React Native + TypeScript). Runs in Hermes on device, browser on web.
- **`supabase/functions/`** — Edge Functions in **Deno** (not Node). Uses `npm:` imports, `Deno.serve`, and `.ts` extensions in imports. Don't try to run `npx tsc` against this; it'll throw on every line.
- **`scripts/`** — One-off Node scripts (TMDb seeder) with its own `package.json`. Run via `tsx --env-file=.env`.

## Data ownership split (the central decision)

The whole architecture rests on this. Read before changing how anything fetches data:

- **TMDb owns the catalog** (shows / seasons / episodes). Read-only reference. We never copy the whole catalog — only `tmdb_show_id` plus a JSONB blob of the TMDb payload in the `shows_cache` table.
- **We own the social graph** (`profiles`, `follows`, `ratings`, `reviews`, `watch_status`, `lists`).
- **Catalog access always goes through Edge Functions** so the TMDb key stays server-side. Never call TMDb from the client.
- `shows_cache` is stale-after-7-days; `get-show` refreshes lazily, `refresh-popular` proactively (batched).

## Polymorphic scope on social tables (subtle)

`watch_status`, `ratings`, and `reviews` all share a `(tmdb_show_id, season_number?, episode_number?)` shape. Nullability encodes the scope:

```
(show_id, NULL,     NULL    ) → applies to the whole show
(show_id, season,   NULL    ) → applies to the whole season
(show_id, season,   episode ) → applies to one episode
```

Uniqueness uses `UNIQUE NULLS NOT DISTINCT` (PG 15+) — without this, default Postgres treats `NULL ≠ NULL` and lets users insert duplicate whole-show rows. Any new social table should follow the same pattern.

**Cross-table scope merges happen in JS, never a SQL/PostgREST join.** Matching a review to its rating (or any two scoped tables) on `(user_id, season_number, episode_number)` in SQL would use `NULL ≠ NULL` and silently drop whole-show-scope rows (season + episode both null). Fetch both sets and merge in JS with explicit `=== null` comparisons — see `get-reviews`.

## Aggregation: episode-aware schema, show-level UI by default

The schema records the finest grain the user gave us (episode / season / show). **List and feed UIs aggregate that up to the show by default**; episode granularity is exposed only on explicit drill-down (Show Detail → Seasons). A user who watched 5 episodes "has watched the show" for the purposes of a Profile grid, even with no whole-show row.

The recurring fork is **inclusion** (which signals put a show in a list) vs **display** (what you aggregate onto the tile) — decide them separately, per view:

- **Profile "Shows" grid** — inclusion is broad: show-scope `watched` **OR** show-scope rating **OR** any watched episode (trust the user to curate). Display: show the star **only** from a show-scope rating; never average episode ratings into a show rating (that's a separate product decision) — tile is poster-only if only episodes were rated.
- **Currently watching** — inclusion is deliberately strict (show-scope `watching` only, so a show finished last month doesn't linger), but the "S2 E5" line _aggregates_ the latest watched episode up to the tile.
- **Diary** (`useDiary`/`/profile/diary`) — the exception that proves the rule: inclusion is every `watch_status` `watched` row (whole-show / season / episode); display does **NOT** aggregate — each event is its own dated entry, labelled with its scope, because a diary is event-level by nature. Rating/review merge onto each entry by its EXACT scope (string scope-key, JS merge).

Same fork still pending on the future activity feed — state the inclusion rule and the aggregation rule explicitly each time.

## RLS principle

Every social table: public SELECT, write only if `user_id = auth.uid()`. `shows_cache` is public SELECT with **no write policy at all** — only the service-role key writes.

Because SELECT is `USING (true)`, queries return _every_ user's rows by default. **Always filter explicitly by `user_id` when you want only the caller's data.** RLS doesn't do this for you on reads.

## Edge Functions

Six of them, all under `supabase/functions/`:

- `get-show` — catalog + caller's social rows for one show; refreshes stale cache. The cached `/tv/{id}` payload appends `credits,content_ratings,watch/providers,external_ids`, and is enriched with an `omdb` field (awards, by IMDb id) — TMDb's API has **no** awards, so we read OMDb's freeform "Awards" string. Backfill-on-view: a payload missing `external_ids` triggers a TMDb refetch; one missing `omdb.tried` triggers a one-off OMDb lookup, cached in-place.
- `get-popular` — the `is_popular` shelf set from `shows_cache`.
- `refresh-popular` — batched re-seed (`?batch=25&offset=N`). Meant for scheduled invocation; one call ≠ all 200 shows (Edge Function execution timeout).
- `get-reviews` — all reviews for a show, enriched with reviewer profile + like count + the reviewer's rating (merged in JS — see the scope-merge rule above). Public read.
- `search-shows` — TMDb `/search/tv` proxy → slim results (`tmdb_show_id`, `name`, `poster_path`, `first_air_date`); keeps the key server-side for the client's live search. Public read.
- `get-person` — actor/cast page: TMDb `/person/{id}?append_to_response=tv_credits` proxied to a slim `{ id, name, biography, profile_path, shows[] }`. **TV-only** (`tv_credits`, never movies); no cache (bios are stable). Powers `usePerson` → `/person/[id]`. Public read.

Shared code in `_shared/`. **Always use the `userClient(req)` / `adminClient()` factories from `_shared/clients.ts`** — they encode the RLS-respect vs RLS-bypass distinction. Constructing clients inline loses that signal.

Auto-injected env vars in every function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — don't set them via `supabase secrets`. Manual secrets: `TMDB_API_KEY` (catalog) and `OMDB_API_KEY` (awards string in `get-show`; omit it and the Awards row just doesn't render). Awards data comes from OMDb, not TMDb — the one non-TMDb catalog source.

## Client data layer

- `src/lib/supabase.ts` — one Supabase client instance, AsyncStorage-backed session.
- `src/api/*` hooks wrap `supabase.functions.invoke(...)` in TanStack Query (5-min default `staleTime`).
- `src/types.ts` is the single source of truth for response shapes. `tmdbImage(path, size)` is the only correct way to build TMDb image URLs — don't string-concat.

## Theme system (light + dark)

`src/theme.ts` exports `fonts`, `radius`, `pad`, **`type`** (named type styles), and two **palettes** — `lightColors` / `darkColors` (same keys, a `Palette` type). Values are exact tokens from the Figma spec — don't ad-hoc them. `type`/`fonts`/`radius`/`pad` carry **no color** and are imported statically as before.

**Colors are read at RENDER time, never baked into a module-level StyleSheet.** Dark mode switches _live_; `StyleSheet.create` copies a color's value once at module load, so a static `import { colors }` can't re-theme. Get the active palette from `src/lib/theme.tsx`:

```tsx
import { type, type Palette } from "@/theme";
import { useThemedStyles, useTheme } from "@/lib/theme";

export function Card() {
  const styles = useThemedStyles(makeStyles); // themed StyleSheet
  const { colors } = useTheme(); // for inline colors in JSX
  return <Text style={[type.statValue, { color: colors.ink }]}>4.6</Text>;
}
// factory param is named `colors` so the StyleSheet body reads identically:
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: colors.surface },
  });
```

`useTheme()` also gives `{ mode, pref, setPref }` (pref = `'light' | 'dark' | 'system'`, persisted in AsyncStorage `pilot.themePref.v1`). The header sun/moon (`ProfileView`) is a 2-way quick flip; Settings › Appearance is the 3-way control. There's one global `<StatusBar>` in `_layout.tsx` that flips its content color with `mode`; banner screens keep a local `<StatusBar style="light" />`.

**Token roles when picking one** (the palette is semantic-ish, with a few overloaded names — get these right or dark mode breaks):

- `background` / `surface` / `surface2` — screen / card+sheet / secondary backgrounds. Screen roots → `background`; elevated overlays (sheets, the nav bar) → `surface`.
- `ink` — primary text/icons **and** active-control fills. FLIPS dark→light, so a selected pill/chip on an `ink` fill inverts for free — but its **label** must then track `background` (not fixed `white`), else it vanishes on the inverted light fill (see `FollowButton`, `Button`, `SeasonPills`, `GenreChips`).
- `white` — FIXED `#FFFFFF`. Use ONLY for a foreground on a _saturated_ fill (label/icon on a purple button). Never a background.
- `bannerInk` — FIXED dark; the always-dark hero banners (list + review).
- `gold`/`green`/`red` — FIXED (stars / FRESH / popularity; read fine on dark).

Don't restate `fontFamily` / `fontSize` per component.

## Path aliases

`@/*` → `./src/*`, `@/assets/*` → `./assets/*`.

## Commands

App (repo root):

```bash
npx expo start                       # dev server; press i / w / scan QR
npx expo start --clear               # nuke Metro cache (needed after native deps, or on bundler weirdness)
npx tsc --noEmit                     # typecheck (src/ only; supabase + scripts excluded)
```

TMDb seed (from `scripts/`):

```bash
cd scripts && npm install            # one-time
npm run seed:sample                  # 10 shows, ~30 sec — always verify before full
npm run seed                         # 200 shows, ~5 min
```

Supabase CLI (repo root, after `supabase link --project-ref <ref>`):

```bash
supabase functions deploy get-show
supabase functions deploy get-popular
supabase functions deploy refresh-popular
supabase functions deploy get-reviews
supabase secrets set TMDB_API_KEY=...
```

## Web caveats

- `app.json` uses `web.output: "single"` (SPA), **not** `"static"`. Static mode SSRs every route in Node, and Supabase + AsyncStorage both touch `window` at init → `ReferenceError`. Don't switch back to `"static"` without first guarding the Supabase init behind `Platform.OS !== 'web'` or a `typeof window !== 'undefined'` check.
- `react-native-svg` works on web but Metro's transform cache sometimes corrupts after install — `--clear` fixes it.

## Write mutations — the canonical pattern

Every mutation hook (`useToggleEpisodeWatched`, `useSetWatchStatus`, `useRate`, `usePostReview`) follows the same shape. Copy it for new ones:

- `await requireAuth()` first — return early if it resolves false (user dismissed login).
- A module-scope **in-flight `Set`** keyed `${showId}:${season}:${episode}` to dedupe rapid taps and double-fires. Per-scope so different rows mutate concurrently.
- Optimistic update in `onMutate` that snapshots **only the slice it owns** (`mySocial.ratings` OR `mySocial.watch_statuses`), and restores just that slice in `onError`. Never snapshot/restore the whole query object — `useRate` and `useSetWatchStatus` share the `['show', id]` key and would clobber each other's in-flight optimistic state.
- `refetchQueries` (not `invalidateQueries`) for the **mounted** `['show', id]` query in `onSettled` — `useShow` has a 5-min `staleTime`, so invalidation alone won't refetch a still-fresh query.
- **Also invalidate the Profile aggregation queries the write feeds** — `['watched']` (Shows grid), `['watching']` (currently-watching), `['watchlist']`. These aren't mounted from the show screen, so `invalidateQueries` (mark stale → refetch on next Profile open) is correct, not `refetchQueries`. Map by effect: status write → all three; show-scope rating / any review / any watched episode → `['watched']`; watched episode also → `['watching']`. **Skipping this is a silent bug** — the write persists but the Profile tab shows stale data until `staleTime` lapses (this is exactly how "added to watchlist but it's not on my profile" happened).
- `if (!user) throw` at the top of `mutationFn` — the session can drop between the gate resolving and the write running; fail loud, not on `user!.id`.

**Table semantics:** `ratings` and `watch_status` are **UPSERT** (idempotent, one row per `(user, scope)`); `reviews` is **INSERT** (multiple reviews per scope allowed; a blank body writes no row — that's a rating-only "log").

**One scoped rating path:** `useRate(showId)` exposes `rate(score, scope?, watchedAt?)` where scope defaults to the whole show. Route ALL rating writes — show / season / episode, action sheet or composer — through it. Don't inline a second scoped upsert anywhere.

**Watched date (`watch_status.watched_at`):** a Postgres **`date`** (calendar day, timezone-free) — the day the user says they watched a scope. The Diary and Profile→Shows→**Watched** order/label by it (tie-broken by `updated_at`). Defaults to the mark date (`current_date`); only the **Review-or-log composer** sets a custom day. **`setWatched(userId, showId, scope, watchedAt?)`** (`src/api/setWatched.ts`) is the SINGLE writer for the "logging ⇒ watched" rule — shared by `useRate` (any scope) and the composer; omit `watchedAt` ⇒ today (and an existing row keeps its date). Always build the `"YYYY-MM-DD"` string from LOCAL parts (`todayLocal`/`fromLocalDate` in `src/types.ts`), **never `toISOString()`** (UTC → wrong day near midnight); read it back by splitting on `-`, never `new Date(str)`. **Logging implies watched at every scope** now: a rating/review at show/season/episode materializes a dated `watched` row — so any write that creates one must invalidate `['diary']` (and `['watched']`).

## Auth model — browse free, gate per action

Anonymous users browse the entire catalog. Login is prompted **per action**, not at a wall: `useRequireAuth()` returns a Promise that resolves `true` after sign-in or `false` on dismissal; callers `await` it before any write. The root `AuthGate` only redirects authed users OUT of the `(auth)` group — it never forces anonymous users in. The `LoginSheet` is mounted once at root by `RequireAuthProvider`.

## Sheets are overlays, not Modals

`Sheet` is a positioned `Animated` overlay (scrim + sheet rendered as **siblings**), NOT an RN `Modal`. iOS can't reliably present one Modal over another, so a Modal sheet couldn't open a second sheet — which the per-action gate needs (LoginSheet over ShowActionSheet). As overlays they stack by render order: a sheet mounted at root sits above in-route sheets, and the underlying sheet keeps its state through the login round-trip. Don't reintroduce `Modal` for sheets.

## Current state

The live snapshot — what's built, what's mocked, what's next, and known issues — lives in `HANDOFF.md` at the repo root. Read it at the start of a session. (Current-state stays there, not here, so the two don't drift.)

## Key things to keep in mind

- Needs to run super fast and smooth
- Core features need to work extremely well
- Should be able to track what Im curerntly watching and hwta others are currently watching and what I and others have liked, watched
- Should be able to specify watched/watching on not just show but also season and episode scope.
- **Pressing:** should be able to create **lists and reviews at season/episode scope**, not just whole-show. Reviews/ratings/watch already work at all 3 scopes — episode/season-scoped **list items** are the remaining gap (see "Down the road").
- Add a popular reviews section on home page (based on likes, comments)
- Eventually more social of course like comment section and recommednations and recommending to your friends and sharing taste profile to insta
- **Social features (liking reviews, comments) are still core, not optional.** The like button is currently a passive count display with no tap handler — schema (`review_likes`) + read path exist, mutation/interactivity deliberately deferred (see Reviews in "Down the road"). Don't treat the half-built state as the intended end state: liking/commenting/sharing are central to what makes the app social and need wiring up.
- Should be hyper clear that you can have lists and keep track of shows across ALL 3 scopes not just show scope and eventually even including actors/characters to lists (also behind premium)
- Need to think about public/private scopes. For example should be hook/route so that I can go one someone elses page and see their reviews and diary and stuff but NOT their drafts.
- Speed and how long it takes to laod is very important, nothing can take more than 3 seconds
- **sharing loop needs to be engineered:** {1. User logs a show or episode.

2. App generates something shareable — review card, recap, taste profile, compatibility result.
3. They share it.
4. Friend installs.
5. Friend follows them.
6. Both return because activity now exists.}

- Hooked self growth loop

## App Store readiness — UGC moderation (NOT built yet; required before PUBLIC submission)

Pilot has user-generated content (reviews, lists, usernames/bios; comments are
deferred). Apple **Guideline 1.2** requires UGC apps to ship moderation infra or
get rejected. **None of this is built yet** — it's the gate between internal
TestFlight and public App Store launch.

**Scope rule — don't over-build too early:** _Internal_ TestFlight (≤100 testers
on your own team) needs NONE of this; no Beta App Review runs. These are required
only for **public App Store submission** and **external/public TestFlight**. Build
when moving internal-test → public, not before. Until then this section is a
known-constraint, not a task.

**The five 1.2 requirements (all needed together for public launch):**

1. **Report** — every piece of others' UGC (reviews, lists, profiles; comments
   when built) needs a Report affordance → a queue. The "Report on others'
   reviews" line under Reviews/"Down the road" is the start of this.
2. **Block** — block a user; their content vanishes for you, no interaction.
   (Serializd reviews explicitly requested this — validated demand, not just
   compliance.)
3. **EULA / terms with a zero-tolerance-for-objectionable-content clause**,
   accepted at signup.
4. **Act on reports within 24h** — at minimum a manual admin path to remove
   content + eject a user, plus the stated commitment.
5. **Filter** — at minimum the report→remove loop; a submission-time text filter
   is a plus.

**Hard dependency (already encoded elsewhere — keep it):** **comments stay
deferred until Report + Block exist.** A free-text field strangers post into,
with no report/block, is the exact 1.2 liability. Likes are a single bit (no free
text) → don't trip 1.2 → that's why likes can ship and comments can't. Don't wire
comments before the moderation pair lands.

**Other public-submission gates (not internal TestFlight):**

- **Account deletion (5.1.1(v))** — in-app delete-account-and-data. Required.
- **Privacy policy** (hosted URL, linked in-app + App Store Connect) + **App
  Privacy label** (declare email/content/identifiers).
- **Demo account** in review notes — Pilot is auth-gated; App Review needs a
  working login or it's rejected as inaccessible.
- **Age rating** set in App Store Connect (UGC trends 12+/17+).
- **Sign in with Apple** — only required IF a third-party social login is offered;
  email-only v1 is exempt.

**TMDb / IP (5.2.1 / 4.1):** TMDb attribution required in-app (the "uses TMDb API
but not endorsed by TMDb" line + logo). The real rejection risk is **copyrighted
posters in App Store screenshots**, not the API — keep a royalty-free screenshot
set as fallback. Cache already honors TMDb's 6-month limit (`shows_cache`
stale-after-7-days refresh). Note: OMDb is the awards source — its terms are
separate; confirm OMDb attribution needs before public launch too.

**Fuller version:** `PILOT_APP_STORE_READINESS.md` (rejection risks ranked, each
marked TestFlight-vs-public). This section is the at-a-glance pointer.

## Down the road (deferred features)

Features parked **deliberately** so essentials ship first — not bugs, not oversights. Decisions/tradeoffs already made; pick up when the core loop is solid. This is the durable index (one line each); the volatile implementation notes live in `HANDOFF.md`'s per-area "deferred" sections. When one ships, delete it here **and** in HANDOFF.

- **Episode/season-scoped list items** — lists hold whole shows only today. To hold seasons/episodes, `list_items` needs the polymorphic scope the other social tables use (nullable `season_number`/`episode_number` + `UNIQUE NULLS NOT DISTINCT`), plus picker drill-down + episode/season render variants. Migration + UI.
- **Lists polish** — reorder + ranked lists (`is_ranked` column exists, unused); public/private (Pilot's first private data → a column + read-scoping RLS); tags; the Search screen's Lists sub-tab (list _search_). _(Rename/edit a list after creation: **done** — `/list/new?edit=`.)_
- **Reviews** — likes + comments (the `review_likes` table exists, unused by UI); see-all + popularity sort + pagination on `get-reviews`; **Report** on others' reviews. _(Edit/delete your own review: **done** — `⋯` → ActionMenuSheet, edit reuses the composer with locked scope. **Review drafts: done** — `reviews.is_draft` (0007); composer has Save draft / Publish; drafts surface only in Profile › Drafts and are filtered from EVERY public review query; publishing is one-way; `useDraftReviews` is own-only since RLS doesn't hide drafts. **Full single-review page: done** — `/review/[id]` (`useReviewDetail`); tapping a review row opens it (backdrop banner + poster + reviewer + stars + date + full body); published-only (drafts → composer); the inline "Read more" expand in `ReviewRow` was retired in favor of it.)_
- **Profile** — _(Top-4 favorites picker: **done** — `/profile/top-shows`, add-order; reorder-via-arrows deferred to post-TestFlight per [[ship-simplest-cut-gestures]]. Diary: **done** — `/profile/diary`, event-level watched log.)_ Remaining: nothing major on Profile itself.
- **Show "% watched" progress** — the nav-row indicator was removed (it was hardcoded `0`). Real version: `watched episodes ÷ total episodes` from the catalog's season `episode_count` + the user's episode-scope `watched` rows. Decide edge cases (whole-show `watched` = 100%? season-scope `watched` = all its episodes?). Bring back when the episode-tracking UI is fleshed out.
- **Activity feed** — the **Friends** feed is **built** (`/activity`, `useActivityFeed`: followees' watched/watchlist/reviews/lists merged client-side). Remaining: the **You** (your own activity) and **Incoming** (likes/follows/comments on you) tabs — add the tab bar when those exist; review likes/comments are a prerequisite for Incoming.
- **Trending → app-activity ranking** — currently TMDb `is_popular`; switch to recency-decayed app activity once usage is real signal (keep `useTrendingShows` as the stable interface so callers don't change).
- **Bulk mark-watched** _(retention · medium effort)_ — a Settings action to mark many shows watched at once (multi-select search → one batched `watch_status` upsert), not one search-and-tap at a time. The Serializd reviewer's #1 love: a new user's backlog is hundreds of shows, and one-at-a-time is where they bounce before the profile feels like theirs. Manual only — distinct from the MCP streaming-import item.
- **Pin reviews & lists to the profile** _(parity · low effort)_ — let a user pin a few reviews/lists to the top of their profile (a `pinned` flag + profile render), the way Top-4 pins favorite shows. Curation that makes a profile feel authored — called out by name in the review.
- **Milestone badges** _(retention · medium effort)_ — badges earned from real watch data (100 / 1,000 episodes, a finished long-runner), shown on the profile. A free engagement loop the reviewer values; computed from existing `watch_status`, no new logging. Keep it editorial, not gamified-noisy.
- **Custom banners (profile / lists / reviews)** _(personalization · high effort)_ — let users pick their own banner image per surface (the `lib/uploadAvatar` → Storage flow is the template; the List detail already renders a `bannerUrl` seam, profile + reviews need a column + render). Free personalization is a core part of what Serializd users praise. (This is the structured version of the raw "Ultimate Customization" line further down — dedupe that when picked up.)
- episode/season-scoped list items
- Tell the people which network to watch it on
- Be able to change to a different poster of the show like they rcently added on Letterboxd for free
- can also add which series are nominated for popular awards - GGlobes, Emmy’s etc.
- Steal letterboxd's premium subscription features, the following are premium featrues
- Connect to streaming services by mcp so it shows when youve watched the show?
- Notif when friends pushed out new review
- Popular reviews section on home
- Watchlist Notifications: Get email or push notifications when movies on your watchlist are added to your preferred streaming platforms?
- Clearer distinction between shows tab and strictly done watched tab
  - Should be able to specify watched/watching on not just show but also season and episode scope.
- Advanced Statistics: Unlocks personalized, real-time insights into your all-time and annual viewing habits. This includes breakdowns of your favorite genres, most-watched actors, average ratings by decade, and a world map of the countries your films originate from.
- Visual Perks: Access to custom app icons (iOS) like widgets
- Ultimate Customization: Choose custom posters and backdrops for your profile, favorites, lists, reviews, and diary entries. You can also select specific images for any cast or crew member.
- Collaborative lists
- Drafts of reviews
- Discussion sections
- Posters/Poster swap
- Characters to be able to rank favourite characters — note: TMDb has no global character ID (only a `character` field on a cast credit), so synthesize identity as `(tmdb_show_id, person_id, character_name)`; do actors first (they have stable person IDs) and depends on ranked lists.
- Be able to search shows by actors
- iPad version
- Adding how many times someone rewatched something to it adds to time watching TV without having to log it sperately so in their profile it can track time watching TV
- Hold down on poster to see options
- Notif when new episode comes out

## Workflow Orchestration

### 1. Plan Node Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity
- Focus on what actually moves the needle, thinking as a user

### 2. Self-Improvement Loop

- After ANY correction from the user: update 'tasks/lessons.md' with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 3. Verification Before Done

- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- Ask me to visually verify and approve after each stage in plan

**Feature done / deploy gate (MANDATORY — do this every time):**
Whenever a feature is finished OR an Edge Function / backend is deployed, STOP.
Do not commit, mark done, or move to the next thing until I've verified. Give me:

1. **A test checklist I can run** — enumerate _every case_, not just the happy
   path: empty state, error/failure, anonymous vs logged-in, the per-action
   login gate, network/offline if relevant, and any scope variants
   (show / season / episode). For each: the exact steps to trigger it and what
   I should expect to see.
2. **What you already verified yourself** (curl, logs, typecheck) vs. **what
   only I can confirm visually** — keep these separate so I know what's left.
3. An explicit **"confirm each passes before we move on"** — then wait. If I
   report any case fails, re-plan; don't push forward on the rest.

The goal: no path ships that breaks for a real user just because we only
checked the happy case.

### 4.Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky:
  "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes
- don't over-engineer
- Challenge your own work before presenting
- Write comments so reader or other agent understands. Concise, only when neccesary.
- Avoid duplicate code

## Secrets & Keys

- TMDb key, Supabase service-role key: server-side only. `.env`, never
  committed, never in client code, never in logs.
- Supabase anon key: safe to ship in the client (designed public, RLS
  protects everything).
- Before any `git push`: verify `.env` is in `.gitignore` and `git status`
  shows no env files staged.
- Never paste a real key into chat, a screenshot, or a commit message.

## Project Context

Pilot is "Letterboxd for TV shows" — track, rate, and review shows AND
individual episodes (the differentiator). The architecture, schema, and
screen specs live in:

- `PILOT_BUILD_PLAN.md` — phases, sequencing, decisions
- `PILOT_DESIGN_SPEC.md` — exact tokens + first three screens
- `PILOT_DESIGN_SPEC_AUTH_PROFILE.md` — Auth + Profile + follows model

**Read these before any non-trivial work.** They contain decisions already
made (NULLS NOT DISTINCT for ratings/watch_status uniqueness, follows are
asymmetric not friend-requests, email-only auth in v1, polymorphic
show/season/episode scope on reviews/ratings). Do not relitigate these.

**Stack**: Expo + React Native + TypeScript, Expo Router, TanStack Query,
Supabase (Postgres + Auth + Edge Functions). TMDb for catalog data, proxied
through Edge Functions — never called direct from the client.

**Data split**: we own users/follows/ratings/reviews/watch_status/lists/feed.
TMDb owns shows/seasons/episodes/cast/images. Store references
(`tmdb_show_id`), never copy the catalog.

## Session Start

Read `HANDOFF.md` first. It contains current project state — what's
built, what's mocked, what's next, and any known issues. The build plan
and design specs describe the destination; the handoff tells you where
we are right now. Do not start work without reading it.

## Code Style

- TypeScript everywhere. No `any` unless commented why. Prefer types over
  interfaces except for public APIs.
- React Native components: function components + hooks only.
- Theme tokens are semantic (`background`, `textPrimary`, `surface`) so
  dark mode is a future config swap, not a rewrite. No raw hex outside
  `theme.ts`.
- Educative comments on non-trivial code (this is set up via the
  educative-comments skill — let it do its job, don't strip its comments) as I don't know react native but I know react.
- File-based routing via Expo Router. Folder structure follows the
  build plan's Phase E layout.
