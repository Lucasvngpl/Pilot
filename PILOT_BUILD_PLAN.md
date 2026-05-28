# Pilot — Build Plan

> Letterboxd for TV shows. Track, rate, and review shows *and individual episodes*.
> Hand this file to Claude Code. Work top to bottom. Each phase produces something testable before the next begins.

---

## 0. The one-line product thesis

Letterboxd has millions of users and still can't track a single episode of TV. Pilot is built episode-first: seasons and episodes are first-class, reviews can attach to a show, a season, or an episode.

**Design system (already prototyped in Figma):**
- Type: Archivo Black (display/titles), Inter (UI/body)
- Color: near-monochrome — ink `#1A1A18` on white, single purple accent `#6B45DC`
- Stat colors: gold star rating, overlapping avatars for viewers, red trend for popularity
- Editorial whitespace, hairline dividers, no chunky cards/shadows

**Three screens already designed:** Home (two poster shelves + FAB), Show Detail (poster hero, stats, reviews-first tabs), Seasons (season pills + episode list with watched checks).

---

## 1. Architecture (decided)

**Data ownership split:**
- **TMDb owns the catalog** — shows, seasons, episodes, cast, images. Read-only reference data. We store *references* (`tmdb_show_id`), never copy the whole catalog.
- **We own the social graph** — users, follows, ratings, reviews, watch status, lists, feed.

**Two data paths from the app:**
1. `app → Supabase` (direct) — auth + all our social data, protected by Row-Level Security.
2. `app → Supabase Edge Function → TMDb` — catalog data. The TMDb key stays server-side; responses are cached into a `shows_cache` table. A scheduled function seeds the curated "top ~200 popular shows" nightly.

**Scope constraint (keep this):** only popular/curated shows at first, not every show ever made. This makes the catalog small, fast, and fully under our control.

**Stack:**
- Client: React Native + Expo + TypeScript, Expo Router (file-based routing), TanStack Query (server state).
- Backend: Supabase (Postgres + Auth + Edge Functions). No separate Node server — Edge Functions *are* the backend.

---

## 2. Build sequence: BACKEND FIRST

Reason: schema settled before any UI depends on it; no screen refactors later. You already know Supabase from CourseCraft, so this isn't new learning.

### Phase A — Supabase project + schema
### Phase B — Seed catalog (TMDb → shows_cache)
### Phase C — Edge Function (catalog read, merged with social data)
### Phase D — TypeScript types + data layer
### Phase E — Expo scaffold + screens (Home → Show Detail → Seasons)

---

## Phase A — Supabase project + schema

**Goal:** a Postgres schema that models the social graph, with RLS so users can only edit their own rows.

1. Create a new Supabase project. Save the project URL and anon key.
2. Enable email auth (and optionally Apple sign-in later — required for iOS App Store if you add other social logins).
3. Create the schema below via the SQL editor or a migration file (`supabase/migrations/0001_init.sql`).

**Tables we own:**

```
profiles          -- 1:1 with auth.users
  id              uuid PK references auth.users
  username        text unique
  display_name    text
  avatar_url      text
  created_at      timestamptz default now()

follows           -- who follows whom
  follower_id     uuid references profiles(id)
  followee_id     uuid references profiles(id)
  created_at      timestamptz default now()
  PRIMARY KEY (follower_id, followee_id)

watch_status      -- a user's relationship to a show/season/episode
  id              uuid PK default gen_random_uuid()
  user_id         uuid references profiles(id)
  tmdb_show_id    int not null
  season_number   int            -- null = whole show
  episode_number  int            -- null = whole season
  status          text           -- 'watching' | 'watched' | 'watchlist'
  updated_at      timestamptz default now()
  UNIQUE (user_id, tmdb_show_id, season_number, episode_number)

ratings           -- a numeric rating, scoped to show/season/episode
  id              uuid PK default gen_random_uuid()
  user_id         uuid references profiles(id)
  tmdb_show_id    int not null
  season_number   int
  episode_number  int
  score           numeric(2,1)   -- 0.5 .. 5.0
  created_at      timestamptz default now()
  UNIQUE (user_id, tmdb_show_id, season_number, episode_number)

reviews           -- text review, scoped to show/season/episode
  id              uuid PK default gen_random_uuid()
  user_id         uuid references profiles(id)
  tmdb_show_id    int not null
  season_number   int
  episode_number  int
  body            text
  contains_spoilers boolean default false
  created_at      timestamptz default now()

review_likes
  review_id       uuid references reviews(id)
  user_id         uuid references profiles(id)
  PRIMARY KEY (review_id, user_id)

lists             -- user-curated lists ("Best of the 2020s")
  id              uuid PK default gen_random_uuid()
  user_id         uuid references profiles(id)
  title           text
  description     text
  is_ranked       boolean default false
  created_at      timestamptz default now()

list_items
  list_id         uuid references lists(id)
  tmdb_show_id    int not null
  position        int
  PRIMARY KEY (list_id, tmdb_show_id)

shows_cache       -- our local copy of TMDb data for curated shows
  tmdb_show_id    int PK
  payload         jsonb          -- full TMDb detail blob (seasons, episodes, images)
  is_popular      boolean default false
  fetched_at      timestamptz default now()
```

**RLS rules (critical):**
- `profiles`: anyone can read; user can update only their own row.
- `ratings` / `reviews` / `watch_status` / `lists` / `list_items`: anyone can read; user can insert/update/delete only rows where `user_id = auth.uid()`.
- `shows_cache`: read-only to clients (writes only via Edge Function service role).

> Claude Code prompt for this phase:
> "Generate `supabase/migrations/0001_init.sql` implementing the schema in Phase A of PILOT_BUILD_PLAN.md, including RLS policies. Add educative SQL comments explaining each policy." (uses the educative-comments approach)

---

## Phase B — Seed the catalog

**Goal:** populate `shows_cache` with ~200 curated popular shows so the app has data without hitting TMDb live for everything.

1. Get a TMDb API key (themoviedb.org → settings → API). Store it as a Supabase secret, never in the repo.
2. Write a one-off seed script (Node/Deno) that:
   - Calls TMDb `/tv/popular` (paginated) to get the top ~200 show IDs.
   - For each, calls `/tv/{id}?append_to_response=season/N` to get full season + episode detail.
   - Upserts each into `shows_cache` with `is_popular = true`.
3. Run it once locally to seed. Later this becomes the scheduled function (Phase C).

> Pitfall: TMDb rate-limits (~50 req/sec). Batch with a small delay. The full detail call per show is what gives you seasons + episodes — don't skip `append_to_response`.

---

## Phase C — Edge Function (catalog read)

**Goal:** one function the app calls to get a show, merged with the current user's social data, key kept server-side.

`supabase/functions/get-show/index.ts`:
- Input: `tmdb_show_id`, (auth context for user).
- Logic:
  1. Read `shows_cache` for that id. If missing or stale (`fetched_at` older than N days), fetch fresh from TMDb (key from secret), upsert, return.
  2. Join the user's `watch_status`, `ratings`, `reviews` for that show.
  3. Return one merged JSON: catalog + this user's relationship to it.
- Also: `get-popular` (returns the `is_popular` set for the Home shelves) and a scheduled `refresh-popular` (re-runs Phase B nightly).

> Why a function and not direct TMDb calls from the phone: the key would ship inside the app binary (extractable), and TMDb rate-limits per key. The function is the chokepoint that protects both.

---

## Phase D — TypeScript types + data layer

**Goal:** lock the data shapes once, share them everywhere.

`src/types.ts`:
```ts
export type Show = {
  tmdbShowId: number;
  name: string;
  creator: string;
  posterUrl: string;
  genres: string[];
  seasons: Season[];
  // aggregate social stats (computed server-side)
  avgRating: number;
  viewerCount: number;
  popularity: number;
};

export type Season = {
  seasonNumber: number;
  name: string;
  year: number;
  episodes: Episode[];
};

export type Episode = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  runtimeMin: number;
  // current user's relationship
  watched: boolean;
  myRating?: number;
};

export type Review = {
  id: string;
  user: { username: string; avatarUrl: string };
  tmdbShowId: number;
  scope: { seasonNumber?: number; episodeNumber?: number }; // empty = whole show
  rating: number;
  body: string;
  likes: number;
  createdAt: string;
};

export type WatchStatus = 'watching' | 'watched' | 'watchlist';
```

`src/api/` — thin TanStack Query hooks: `useShow(id)`, `usePopular()`, `useReviews(id)`, `useToggleWatched(...)`, `useRate(...)`, `usePostReview(...)`. Each wraps a Supabase call or an Edge Function call.

> The `scope` field on Review is the heart of Pilot — a review can target the whole show, a season, or one episode. Keep it.

---

## Phase E — Expo scaffold + screens

1. `npx create-expo-app pilot --template` (TypeScript template). Add Expo Router, TanStack Query, Supabase JS client.
2. Folder structure:
```
app/                 -- Expo Router (file-based)
  _layout.tsx        -- tab navigator (Home, Activity, Log, Search, Profile)
  index.tsx          -- Home
  show/[id].tsx      -- Show Detail (Reviews tab default)
  show/[id]/seasons.tsx -- Seasons / episode list
src/
  types.ts
  api/               -- TanStack Query hooks
  components/        -- Poster, ReviewRow, StatRow, EpisodeRow, BottomNav, FAB
  theme.ts           -- colors, fonts, spacing tokens from the design system
```
3. Build order, each wired to the real Supabase/Edge data via the Phase D hooks:
   - **Home** first (poster shelves + FAB) — proves the data layer end to end.
   - **Show Detail** (poster hero, stat row, reviews-first tabs).
   - **Seasons** (season pills, episode rows with watched toggle — wire `useToggleWatched`).
4. Pull the visual spec from Figma: Claude Code shares this MCP connection, so point it at the Pilot Figma file and have it match the components to the actual frames.

> Claude Code prompt for this phase:
> "Scaffold the Expo app per Phase E. Build `theme.ts` from the design system in section 0. Then build the Poster and BottomNav components, matching the Pilot Figma file (file key in the repo README). Add educative comments to all new TS/TSX."

---

## Definition of done for v1

- Sign up / log in (Supabase auth).
- Home shows real popular shows from `shows_cache`.
- Open a show → see its detail + real reviews.
- Open Seasons → toggle an episode watched → it persists (round-trips to `watch_status`).
- Post a review scoped to a show, season, or episode.

That's the MVP. Lists, feed, follows, profiles come after — and after you've shown it to 3–5 people.

---

## Notes / decisions deferred

- Apple Sign-In: required by App Store *if* you offer other third-party logins. Email-only avoids it for now.
- Accent color: keeping purple for v1 (homage). Revisit a custom recessive accent post-users.
- Next.js: not part of the iOS app. Only relevant later for a marketing site or web version.
- Per-episode watched-tracking UI exists; richer progress/feed features are explicitly v2.
