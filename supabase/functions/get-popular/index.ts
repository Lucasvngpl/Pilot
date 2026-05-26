/**
 * get-popular — Edge Function
 *
 * GET /functions/v1/get-popular?limit=50
 *
 * Returns the curated popular shows for the Home shelves, newest-fetched first.
 *
 *   { shows: [{ tmdb_show_id, payload }, ...] }
 *
 * `payload` is the full TMDb blob — the client picks name / poster_path /
 * etc. Keeping the blob whole means we don't need to evolve this endpoint
 * every time the UI wants a new field.
 *
 * Open endpoint — no auth required. shows_cache has a public SELECT policy,
 * so userClient(req) works whether the caller is signed in or anonymous.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { userClient } from '../_shared/clients.ts';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Clamp limit between 1 and MAX_LIMIT — protects against `?limit=99999`
    // exhausting bandwidth or accidentally exposing the whole table.
    const limit = Math.min(
      Math.max(Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );

    const client = userClient(req);
    const { data, error } = await client
      .from('shows_cache')
      .select('tmdb_show_id, payload')
      .eq('is_popular', true)
      .order('fetched_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return json({ shows: data ?? [] });
  } catch (err) {
    console.error('get-popular error:', err);
    return json({ error: err instanceof Error ? err.message : 'unknown' }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
