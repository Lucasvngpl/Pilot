// TMDb fetch helpers for Edge Functions.
//
// Mirrors scripts/seed-shows.ts. The duplication is intentional: scripts/
// runs in Node, supabase/functions/ runs in Deno. Different runtimes,
// different module systems — sharing this little code isn't worth a build
// step.

const TMDB = 'https://api.themoviedb.org/3';
const DELAY_MS = 125;

export async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const key = Deno.env.get('TMDB_API_KEY');
  if (!key) throw new Error('TMDB_API_KEY not set in function secrets');

  const url = new URL(`${TMDB}${path}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  // Retry on 429 (rate limited) / 5xx (TMDb hiccup) with exponential backoff.
  // 4xx-other and exhausted retries throw — fail loud so the caller can react.
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url.toString());
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      await sleep(500 * 2 ** attempt); // 500ms, 1s, 2s, 4s
      continue;
    }
    throw new Error(`TMDb ${path} -> ${res.status}: ${await res.text()}`);
  }
  throw new Error(`TMDb ${path} -> retries exhausted`);
}

/**
 * Fetch a show + all its real seasons (skipping specials / season 0).
 *
 * Two-pass: get the show summary to learn the season list, then fetch each
 * season individually for its full episode list. ~1 + N requests per show
 * where N = number of real seasons.
 */
export async function fetchShowDetail(id: number) {
  type ShowDetail = {
    id: number;
    name: string;
    seasons: Array<{ season_number: number }>;
  };

  const show = await tmdbGet<ShowDetail>(`/tv/${id}`);
  await sleep(DELAY_MS);

  const realSeasonNumbers = show.seasons
    .map((s) => s.season_number)
    .filter((n) => n > 0);

  const seasons: unknown[] = [];
  for (const n of realSeasonNumbers) {
    const season = await tmdbGet<unknown>(`/tv/${id}/season/${n}`);
    seasons.push(season);
    await sleep(DELAY_MS);
  }

  // Replace the summary `seasons` array with the detailed version (each
  // season now carries its full `episodes` array).
  return { ...show, seasons };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
