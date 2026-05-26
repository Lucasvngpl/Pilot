/**
 * scripts/seed-shows.ts
 *
 * Seeds `shows_cache` with ~200 curated popular shows from TMDb.
 *
 * This is a ONE-OFF bootstrap. Later (Phase C) the same logic moves into a
 * scheduled Edge Function (`refresh-popular`) that runs nightly.
 *
 * ---------------------------------------------------------------------------
 * Setup
 * ---------------------------------------------------------------------------
 *   cd scripts
 *   npm install
 *
 * Then create a `.env` file in this directory:
 *
 *   TMDB_API_KEY=<your TMDb v3 key>
 *   SUPABASE_URL=https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key — NOT the anon key!>
 *
 *   # Optional. Default is 200.
 *   # TARGET_COUNT=20
 *
 * The service-role key bypasses RLS, which is what lets this script write
 * to `shows_cache` (clients can only read). Keep it secret — anyone with
 * this key has admin access to your DB.
 *
 * ---------------------------------------------------------------------------
 * Run
 * ---------------------------------------------------------------------------
 *   npm run seed
 *
 * That executes:  tsx --env-file=.env seed-shows.ts
 *
 * Node 20+ understands `--env-file` natively, so no `dotenv` dependency.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 *   1. Walks TMDb's /tv/popular endpoint (paginated) until it has
 *      `TARGET_COUNT` distinct show IDs.
 *   2. For each show, fetches the show detail then each "real" season's full
 *      episode list (skipping season 0 / specials).
 *   3. Upserts the full TMDb payload into `shows_cache` with
 *      `is_popular = true`.
 *
 * Idempotent: re-running the script just refreshes existing rows (the upsert
 * uses tmdb_show_id as the conflict key).
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Env / config
// ---------------------------------------------------------------------------

const TMDB_API_KEY              = required('TMDB_API_KEY');
const SUPABASE_URL              = required('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');
const TARGET_COUNT              = Number(process.env.TARGET_COUNT ?? 200);

// `persistSession: false` because this is a short-lived script — no token
// refresh, no localStorage writes, no `auth.onAuthStateChange` listeners.
// Without it the client tries to write to a non-existent storage backend.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// TMDb is generous (~50 req/sec per IP) but we throttle to ~8/sec to leave
// headroom for retries and avoid any 429s under bursts.
const TMDB_DELAY_MS = 125;

// ---------------------------------------------------------------------------
// TMDb fetch helper
// ---------------------------------------------------------------------------

const TMDB = 'https://api.themoviedb.org/3';

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // Retry-with-backoff on 429 (rate-limited) or 5xx (TMDb hiccup).
  // 4xx (other) and the 4th attempt throw — fail loud so the loop notices.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url.toString());
    if (res.ok) return (await res.json()) as T;

    if (res.status === 429 || res.status >= 500) {
      const backoff = 500 * 2 ** attempt; // 500ms, 1s, 2s, 4s
      console.warn(`  TMDb ${path} -> ${res.status}, retrying in ${backoff}ms...`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`TMDb ${path} -> ${res.status}: ${await res.text()}`);
  }
  throw new Error(`TMDb ${path} -> retries exhausted`);
}

// ---------------------------------------------------------------------------
// TMDb response shapes (only the slices we actually read — we keep the rest
// in `payload` as opaque JSON for the client to interpret)
// ---------------------------------------------------------------------------

type PopularPage = {
  page: number;
  total_pages: number;
  results: Array<{ id: number; name: string }>;
};

type ShowDetail = {
  id: number;
  name: string;
  seasons: Array<{ season_number: number }>;
};

// ---------------------------------------------------------------------------
// Core steps
// ---------------------------------------------------------------------------

/**
 * Walk /tv/popular pages until we have `targetCount` distinct IDs.
 * Using a Set in case TMDb ever returns duplicates across pages.
 */
async function fetchPopularIds(targetCount: number): Promise<number[]> {
  const ids = new Set<number>();
  let page = 1;

  while (ids.size < targetCount) {
    const data = await tmdbGet<PopularPage>('/tv/popular', { page: String(page) });
    for (const show of data.results) {
      ids.add(show.id);
      if (ids.size >= targetCount) break;
    }
    if (page >= data.total_pages) break;
    page++;
    await sleep(TMDB_DELAY_MS);
  }

  return [...ids].slice(0, targetCount);
}

/**
 * Fetch a show + every "real" season's full episode list.
 *
 * Two-pass approach:
 *   1. GET /tv/{id} -> the show's `seasons` array (summaries only).
 *   2. For each non-special season (season_number > 0), GET that season
 *      separately to pick up the episode list.
 *
 * Could use `append_to_response=season/1,season/2,...` to combine into one
 * request, but you don't know the season numbers until pass 1 anyway, and
 * the all-in-one response can be huge for long-running shows.
 */
async function fetchShowDetail(id: number): Promise<ShowDetail & { seasons: unknown[] }> {
  const show = await tmdbGet<ShowDetail>(`/tv/${id}`);
  await sleep(TMDB_DELAY_MS);

  const realSeasonNumbers = show.seasons
    .map((s) => s.season_number)
    .filter((n) => n > 0); // skip specials (season 0)

  const seasons: unknown[] = [];
  for (const n of realSeasonNumbers) {
    const season = await tmdbGet<unknown>(`/tv/${id}/season/${n}`);
    seasons.push(season);
    await sleep(TMDB_DELAY_MS);
  }

  // Replace the summary `seasons` with the detailed version — each season
  // now carries its full `episodes` array.
  return { ...show, seasons };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding ${TARGET_COUNT} popular shows from TMDb...\n`);

  const ids = await fetchPopularIds(TARGET_COUNT);
  console.log(`  Collected ${ids.length} ids.\n`);

  let ok = 0;
  let failed = 0;

  for (let i = 0; i < ids.length; i++) {
    const id  = ids[i];
    const tag = `[${String(i + 1).padStart(3, ' ')}/${ids.length}]`;

    try {
      const payload = await fetchShowDetail(id);

      const { error } = await supabase.from('shows_cache').upsert({
        tmdb_show_id: id,
        payload,
        is_popular: true,
        fetched_at: new Date().toISOString(),
      });

      if (error) {
        failed++;
        console.error(`${tag} x ${payload.name ?? id}: ${error.message}`);
      } else {
        ok++;
        console.log(`${tag} ok ${payload.name ?? id}`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${tag} x ${id}: ${msg}`);
    }
  }

  console.log(`\nDone. ${ok} succeeded, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
