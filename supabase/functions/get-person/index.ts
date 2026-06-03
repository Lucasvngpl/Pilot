/**
 * get-person — Edge Function (runs on Supabase's servers, in Deno — NOT in the app)
 *
 * GET  /functions/v1/get-person?person_id=123
 * POST /functions/v1/get-person   body: { "person_id": 123 }
 *
 * Why it exists: the TMDb API key is a secret. Anything in the app bundle ships
 * to every phone and is stealable, so the phone can't call TMDb directly. This
 * function holds the key server-side and proxies the call, then hands back a slim,
 * UI-ready JSON shape:
 *
 *   { id, name, biography, profile_path,
 *     shows: [{ tmdb_show_id, name, poster_path, character, year }] }
 *
 * TV-only (Pilot is TV) — reads tv_credits, never movie_credits. No tables, no
 * cache (bios are stable). Anonymous-safe. Mirrors search-shows.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { tmdbGet } from '../_shared/tmdb.ts';

// `type` aliases describing the SLICE of TMDb's huge response we actually read.
// `?` marks a field optional (may be absent); `| null` marks it nullable. Typing
// only what we use keeps the mapping below honest and self-documenting.
type Credit = { id: number; name?: string; poster_path?: string | null; character?: string; first_air_date?: string };
type Person = { id: number; name: string; biography?: string; profile_path?: string | null; tv_credits?: { cast?: Credit[] } };

// Deno.serve registers the HTTP handler — it runs once PER REQUEST. `req` is the
// incoming Request; we must return a Response.
Deno.serve(async (req) => {
  // Browsers send a CORS "preflight" OPTIONS request before the real one; answer it.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const id = await parsePersonId(req);
    if (!id) return json({ error: 'person_id (positive int) required' }, 400);

    // The one privileged call. The <Person> generic types what tmdbGet returns,
    // so `p` below is fully typed. append_to_response folds the actor's TV roles
    // into the SAME request (one round-trip instead of two).
    const p = await tmdbGet<Person>(`/person/${id}`, { append_to_response: 'tv_credits' });

    // Dedupe by show (an actor can have several credits in one show). A Map keyed
    // by show id keeps the FIRST credit seen per show; `?? []` guards the optional
    // chain so we iterate an empty array rather than crash when fields are missing.
    const byShow = new Map<number, Credit>();
    for (const c of p.tv_credits?.cast ?? []) {
      if (!byShow.has(c.id)) byShow.set(c.id, c);
    }
    // [...map.values()] spreads the Map's values into a plain array we can sort/map.
    const shows = [...byShow.values()]
      // localeCompare on the date strings sorts newest-first (b vs a = descending);
      // `?? ''` makes a missing date sort last instead of throwing.
      .sort((a, b) => (b.first_air_date ?? '').localeCompare(a.first_air_date ?? ''))
      // Reshape each TMDb credit into our slim UI shape.
      .map((c) => ({
        tmdb_show_id: c.id,
        name: c.name ?? 'Untitled',
        poster_path: c.poster_path ?? null,
        character: c.character ?? null,
        year: c.first_air_date ? c.first_air_date.slice(0, 4) : null, // "2019-03-24" → "2019"
      }));

    return json({
      id: p.id,
      name: p.name,
      biography: p.biography ?? null,
      profile_path: p.profile_path ?? null,
      shows,
    });
  } catch (err) {
    // Log the detail server-side ONLY; return a generic message so we never leak
    // internals (schema, TMDb errors) to an anonymous caller.
    console.error('get-person error:', err);
    return json({ error: 'Could not load person.' }, 500);
  }
});

// Accept the id from the query string (GET) or the JSON body (POST). Returns a
// positive integer or null — the caller turns null into a 400.
async function parsePersonId(req: Request): Promise<number | null> {
  const parse = (v: unknown) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };
  const fromQuery = new URL(req.url).searchParams.get('person_id');
  if (fromQuery) return parse(fromQuery);
  if (req.method === 'POST') {
    try { return parse((await req.json()).person_id); } catch { return null; }
  }
  return null;
}

// Tiny helper: serialize a body to JSON with the CORS headers + a status code.
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
