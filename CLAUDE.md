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

## RLS principle

Every social table: public SELECT, write only if `user_id = auth.uid()`. `shows_cache` is public SELECT with **no write policy at all** — only the service-role key writes.

Because SELECT is `USING (true)`, queries return _every_ user's rows by default. **Always filter explicitly by `user_id` when you want only the caller's data.** RLS doesn't do this for you on reads.

## Edge Functions

Three of them, all under `supabase/functions/`:

- `get-show` — catalog + caller's social rows for one show; refreshes stale cache.
- `get-popular` — the `is_popular` shelf set from `shows_cache`.
- `refresh-popular` — batched re-seed (`?batch=25&offset=N`). Meant for scheduled invocation; one call ≠ all 200 shows (Edge Function execution timeout).

Shared code in `_shared/`. **Always use the `userClient(req)` / `adminClient()` factories from `_shared/clients.ts`** — they encode the RLS-respect vs RLS-bypass distinction. Constructing clients inline loses that signal.

Auto-injected env vars in every function: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — don't set them via `supabase secrets`. Only `TMDB_API_KEY` is a manual secret.

## Client data layer

- `src/lib/supabase.ts` — one Supabase client instance, AsyncStorage-backed session.
- `src/api/*` hooks wrap `supabase.functions.invoke(...)` in TanStack Query (5-min default `staleTime`).
- `src/types.ts` is the single source of truth for response shapes. `tmdbImage(path, size)` is the only correct way to build TMDb image URLs — don't string-concat.

## Theme system

`src/theme.ts` exports `colors`, `fonts`, `radius`, `pad`, and **`type`** (named type styles). Values are exact tokens from the Figma design spec — don't ad-hoc them. Spread type styles + apply color alongside:

```tsx
<Text style={[type.statValue, { color: colors.ink }]}>4.6</Text>
```

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
supabase secrets set TMDB_API_KEY=...
```

## Web caveats

- `app.json` uses `web.output: "single"` (SPA), **not** `"static"`. Static mode SSRs every route in Node, and Supabase + AsyncStorage both touch `window` at init → `ReferenceError`. Don't switch back to `"static"` without first guarding the Supabase init behind `Platform.OS !== 'web'` or a `typeof window !== 'undefined'` check.
- `react-native-svg` works on web but Metro's transform cache sometimes corrupts after install — `--clear` fixes it.

## Phase status — mocks and stubs

Search for `TODO(phase-future)` to find seams. Currently mocked or unbuilt:

- Friend feed on Home (`MOCK_FRIENDS` in `src/app/index.tsx`).
- Popular reviews on Show Detail (`MOCK_REVIEWS` in `src/app/show/[id]/index.tsx`).
- Episode-level rating aggregation, watched-toggle persistence.
- Write-mutation hooks (`useToggleWatched`, `useRate`, `usePostReview`) — schema + RLS already support them.

Routes that 404 if tapped:

- Bottom nav: Activity / Log / Search / Profile (only Home `/` is implemented).
- Show Detail tabs: Overview / Lists (Reviews + Seasons exist).

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

### 4.Demand Elegance (Balanced)

- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky:
  "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes
- don't over-engineer
- Challenge your own work before presenting
- Write comments so reader or other agent understands. Concise, only when neccesary.

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
