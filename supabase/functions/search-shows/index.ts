/**
 * search-shows — Edge Function
 *
 * GET  /functions/v1/search-shows?query=stranger
 * POST /functions/v1/search-shows   body: { "query": "stranger" }
 *
 * Thin proxy over TMDb /search/tv so the TMDb key stays server-side. Returns a
 * slim, UI-ready result list:
 *
 *   { results: [{ tmdb_show_id, name, poster_path, first_air_date }] }
 *
 * Deliberately does NOT write shows_cache — search hits are query-dependent and
 * ephemeral, unlike the curated is_popular set. A show only enters the cache
 * when someone actually VIEWS it (get-show lazily caches on first view). So this
 * function touches no tables and needs no Supabase client.
 *
 * Open endpoint — anonymous-safe, no auth.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { searchTv } from '../_shared/tmdb.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const query = await parseQuery(req);
    if (!query) return json({ results: [] }); // blank query → nothing to search

    const data = await searchTv(query);
    const results = (data.results ?? []).map((r) => ({
      tmdb_show_id: r.id,
      name: r.name,
      poster_path: r.poster_path ?? null,
      first_air_date: r.first_air_date ?? null,
    }));

    return json({ results });
  } catch (err) {
    console.error('search-shows error:', err); // detail server-side only
    return json({ error: 'Search failed.' }, 500);
  }
});

async function parseQuery(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('query');
  if (fromQuery && fromQuery.trim()) return fromQuery.trim().slice(0, 200); // cap length
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const q = typeof body.query === 'string' ? body.query.trim().slice(0, 200) : '';
      return q || null;
    } catch {
      return null;
    }
  }
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
