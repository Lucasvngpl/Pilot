/**
 * get-show — Edge Function
 *
 * GET  /functions/v1/get-show?tmdb_show_id=123
 * POST /functions/v1/get-show   body: { "tmdb_show_id": 123 }
 *
 * Returns one show's catalog data merged with the caller's social rows:
 *
 *   {
 *     catalog: <full TMDb show blob>,
 *     mySocial: {
 *       watch_statuses: [...],   // this user's rows for this show
 *       ratings:        [...],
 *       reviews:        [...]
 *     }
 *   }
 *
 * Catalog flow:
 *   - Read from shows_cache (admin client — bypasses RLS).
 *   - If missing or older than 7 days, refresh from TMDb and upsert.
 *   - If TMDb refresh fails but we have a stale row, return the stale row.
 *     Better stale than broken.
 *
 * mySocial flow:
 *   - Anonymous caller: returns empty arrays.
 *   - Authed caller: queries the three social tables filtered by user_id +
 *     tmdb_show_id. RLS would also enforce this, but the explicit filter
 *     prevents accidentally returning ALL users' public rows.
 *
 * Required secret:
 *   supabase secrets set TMDB_API_KEY=<key>
 */

import { corsHeaders } from '../_shared/cors.ts';
import { adminClient, userClient } from '../_shared/clients.ts';
import { fetchShowDetail } from '../_shared/tmdb.ts';

const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const tmdb_show_id = await parseShowId(req);
    if (!tmdb_show_id) {
      return json({ error: 'tmdb_show_id (positive int) required' }, 400);
    }

    // 1. Catalog — admin client because we may need to write on stale.
    const admin = adminClient();
    const baseCatalog = await fetchOrRefresh(admin, tmdb_show_id);
    if (!baseCatalog) {
      return json({ error: 'show not found' }, 404);
    }
    // Awards (OMDb) — TMDb's API has no awards, so we enrich the catalog with
    // OMDb's freeform "Awards" string, looked up by IMDb id and cached in-place.
    const catalog = await ensureAwards(admin, tmdb_show_id, baseCatalog);

    // 2. Social — caller's client, RLS-enforced.
    const user = userClient(req);
    const { data: { user: authUser } } = await user.auth.getUser();
    const mySocial = authUser
      ? await fetchUserSocial(user, tmdb_show_id, authUser.id)
      : EMPTY_SOCIAL;

    // 3. Community stats for the stat row — public aggregates over everyone's
    //    rows (RLS SELECT is public), so these run regardless of auth. The
    //    viewer avatars need the caller's id (only faces they follow are shown).
    const stats = await computeStats(user, tmdb_show_id, authUser?.id ?? null);

    return json({ catalog, mySocial, stats });
  } catch (err) {
    console.error('get-show error:', err); // detail server-side only
    return json({ error: 'Something went wrong loading the show.' }, 500);
  }
});

// ----------------------------------------------------------------------------

const EMPTY_SOCIAL = { watch_statuses: [], ratings: [], reviews: [] };

/**
 * Accept tmdb_show_id from query string (GET) or JSON body (POST).
 * Returns the integer or null if missing/invalid.
 */
async function parseShowId(req: Request): Promise<number | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('tmdb_show_id');
  if (fromQuery) {
    const n = Number(fromQuery);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const n = Number(body.tmdb_show_id);
      return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchOrRefresh(
  admin: ReturnType<typeof adminClient>,
  tmdb_show_id: number,
): Promise<unknown | null> {
  const { data: existing } = await admin
    .from('shows_cache')
    .select('payload, fetched_at, is_popular')
    .eq('tmdb_show_id', tmdb_show_id)
    .maybeSingle();

  // A payload cached before we appended the extra sub-resources lacks them; treat
  // that as needing a refresh even if it's time-fresh, so they backfill on the
  // FIRST view of each show (not whenever the 7-day window lapses). Self-healing:
  // after one refetch the key is present, so it's fresh again. `external_ids` is
  // the newest appended field, so its presence means "fetched with the current
  // append shape" (credits + content_ratings + watch/providers + external_ids).
  const hasLatest = !!(existing?.payload as { external_ids?: unknown } | null)?.external_ids;
  const isFresh = existing &&
    Date.now() - new Date(existing.fetched_at).getTime() < STALE_AFTER_MS &&
    hasLatest;

  if (isFresh) return existing.payload;

  // Stale or missing — try to refresh from TMDb.
  try {
    const fresh = await fetchShowDetail(tmdb_show_id);
    await admin.from('shows_cache').upsert({
      tmdb_show_id,
      payload: fresh,
      // Preserve the popularity flag if we already had it; don't add new
      // shows to the popular set just because someone viewed one.
      is_popular: existing?.is_popular ?? false,
      fetched_at: new Date().toISOString(),
    });
    return fresh;
  } catch (err) {
    console.warn(`TMDb refresh failed for ${tmdb_show_id}:`, err);
    // Better stale than broken.
    return existing?.payload ?? null;
  }
}

type OmdbState = { awards: string | null; tried: boolean };

/**
 * Enrich a catalog payload with OMDb's freeform "Awards" string — TMDb's API has
 * no awards. Looked up by the show's IMDb id (from the appended external_ids) and
 * cached IN the payload, so it's ~one OMDb call per show (not per view).
 *
 *  - Already attempted with a key (omdb.tried) → return as-is (no call).
 *  - Key set → call OMDb, cache `{ awards, tried:true }`. "N/A"/errors → awards
 *    null (still tried, so no pointless re-fetch for award-less shows).
 *  - No OMDB_API_KEY yet → return a TRANSIENT `{tried:false}` WITHOUT persisting,
 *    so it retries once the secret is set rather than caching "no awards".
 *
 * The omdb field is dropped whenever TMDb refreshes (7-day stale), so awards
 * refresh alongside the catalog.
 */
async function ensureAwards(
  admin: ReturnType<typeof adminClient>,
  tmdb_show_id: number,
  payload: unknown,
): Promise<unknown> {
  const p = payload as
    | { omdb?: OmdbState; external_ids?: { imdb_id?: string | null } }
    | null;
  if (!p) return payload;
  if (p.omdb?.tried) return payload;

  const key = Deno.env.get('OMDB_API_KEY');
  if (!key) {
    // Not configured — surface no awards, but don't persist (retry once it's set).
    return { ...p, omdb: { awards: null, tried: false } satisfies OmdbState };
  }

  const imdbId = p.external_ids?.imdb_id ?? null;
  let awards: string | null = null;
  if (imdbId) {
    try {
      const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${key}`);
      const data = await res.json();
      awards = data?.Awards && data.Awards !== 'N/A' ? String(data.Awards) : null;
    } catch (err) {
      console.warn(`OMDb lookup failed for ${imdbId}:`, err);
    }
  }

  const updated = { ...p, omdb: { awards, tried: true } satisfies OmdbState };
  // Patch only this row's payload — no TMDb refetch needed.
  await admin.from('shows_cache').update({ payload: updated }).eq('tmdb_show_id', tmdb_show_id);
  return updated;
}

async function fetchUserSocial(
  user: ReturnType<typeof userClient>,
  tmdb_show_id: number,
  userId: string,
) {
  // Explicit user_id filter even though RLS already restricts writes — RLS
  // SELECT is `using (true)` (public), so without this filter we'd return
  // EVERYONE's rows. Public reviews belong on a separate endpoint.
  const [status, ratings, reviews] = await Promise.all([
    user.from('watch_status').select('*')
      .eq('user_id', userId).eq('tmdb_show_id', tmdb_show_id),
    user.from('ratings').select('*')
      .eq('user_id', userId).eq('tmdb_show_id', tmdb_show_id),
    user.from('reviews').select('*')
      .eq('user_id', userId).eq('tmdb_show_id', tmdb_show_id).eq('is_draft', false),
  ]);

  return {
    watch_statuses: status.data ?? [],
    ratings: ratings.data ?? [],
    reviews: reviews.data ?? [],
  };
}

type ViewerAvatar = { id: string; username: string; avatar_url: string | null };

/**
 * Community stats for the stat row (NOT the caller's — everyone's rows):
 *  - avgRating: Pilot average of SHOW-SCOPE ratings (out of 5), null if none.
 *  - viewers:   distinct users who watched or are watching (any scope).
 *  - viewerAvatars: up to 3 profiles of viewers the CALLER follows — NEVER
 *    strangers. Empty when the caller follows none of them (or is anonymous);
 *    the UI then shows gray placeholders. Honest count + anonymous circles beats
 *    fake social proof from strangers.
 *  - popularity stays TMDb (from the catalog payload, client-side).
 * RLS SELECT is public, so the user client sees all rows here.
 */
async function computeStats(
  client: ReturnType<typeof userClient>,
  tmdb_show_id: number,
  authUserId: string | null,
) {
  const [ratingsRes, watchersRes] = await Promise.all([
    client
      .from('ratings')
      .select('score')
      .eq('tmdb_show_id', tmdb_show_id)
      .is('season_number', null)
      .is('episode_number', null),
    client
      .from('watch_status')
      .select('user_id')
      .eq('tmdb_show_id', tmdb_show_id)
      .in('status', ['watched', 'watching']),
  ]);

  const scores = (ratingsRes.data ?? []).map((r) => r.score as number);
  const avgRating = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  const viewerIds = [...new Set((watchersRes.data ?? []).map((w) => w.user_id as string))];
  const viewers = viewerIds.length;

  // Faces: only viewers the caller follows (never strangers).
  let viewerAvatars: ViewerAvatar[] = [];
  if (authUserId && viewerIds.length > 0) {
    const { data: follows } = await client
      .from('follows')
      .select('followee_id')
      .eq('follower_id', authUserId)
      .in('followee_id', viewerIds);
    const followedIds = (follows ?? []).map((f) => f.followee_id as string).slice(0, 3);
    if (followedIds.length > 0) {
      const { data: profiles } = await client
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', followedIds);
      viewerAvatars = (profiles ?? []) as ViewerAvatar[];
    }
  }

  return { avgRating, ratingCount: scores.length, viewers, viewerAvatars };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
