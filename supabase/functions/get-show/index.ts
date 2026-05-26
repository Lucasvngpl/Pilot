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
    const catalog = await fetchOrRefresh(admin, tmdb_show_id);
    if (!catalog) {
      return json({ error: 'show not found' }, 404);
    }

    // 2. Social — caller's client, RLS-enforced.
    const user = userClient(req);
    const { data: { user: authUser } } = await user.auth.getUser();
    const mySocial = authUser
      ? await fetchUserSocial(user, tmdb_show_id, authUser.id)
      : EMPTY_SOCIAL;

    return json({ catalog, mySocial });
  } catch (err) {
    console.error('get-show error:', err);
    return json({ error: err instanceof Error ? err.message : 'unknown' }, 500);
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

  const isFresh = existing &&
    Date.now() - new Date(existing.fetched_at).getTime() < STALE_AFTER_MS;

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
      .eq('user_id', userId).eq('tmdb_show_id', tmdb_show_id),
  ]);

  return {
    watch_statuses: status.data ?? [],
    ratings: ratings.data ?? [],
    reviews: reviews.data ?? [],
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
