import { supabase } from '@/lib/supabase';
import { buildScopeArt } from '@/types';
import type { ShowCard, TmdbPayload, GetShowResponse } from '@/types';

/**
 * Look up catalog cards (name + poster) for a set of show ids.
 *
 * Why a separate fetch instead of a PostgREST join: `shows_cache` has no foreign
 * key from `watch_status` / `ratings` (those reference `profiles`, and the show
 * id is just an int), so PostgREST can't embed the poster in one query. We fetch
 * the catalog blobs for the ids we already have and return a lookup map; callers
 * merge in JS — the same explicit-merge discipline get-reviews uses.
 *
 * Fast path reads our OWN cache table (public SELECT). Any id NOT cached yet
 * (e.g. a show added to a list from live TMDb search, which never writes the
 * cache) falls back to the `get-show` Edge Function — the only sanctioned catalog
 * path, so the TMDb *key* stays server-side. That function caches the payload as
 * a side effect, so the miss self-heals for next time.
 */
export async function fetchShowCards(
  ids: number[],
  opts?: { withScopeArt?: boolean },
): Promise<Map<number, ShowCard>> {
  const map = new Map<number, ShowCard>();
  if (ids.length === 0) return map;
  const withArt = opts?.withScopeArt ?? false;

  const { data, error } = await supabase
    .from('shows_cache')
    .select('tmdb_show_id, payload')
    .in('tmdb_show_id', ids);
  if (error) throw error;

  for (const row of data ?? []) {
    const payload = row.payload as TmdbPayload;
    map.set(row.tmdb_show_id, {
      tmdb_show_id: row.tmdb_show_id,
      name: payload?.name ?? 'Untitled',
      poster_path: payload?.poster_path ?? null,
      // Surfaced for the review-detail hero. Harmless elsewhere (optional field).
      backdrop_path: payload?.backdrop_path ?? null,
      scopeArt: withArt ? buildScopeArt(payload) : undefined,
    });
  }

  // Cache misses → fetch via get-show (caches as a side effect). Parallel; a
  // failure just leaves that id absent (callers fall back to a poster-less tile),
  // so one bad id never blocks the rest. Misses are the exception (most shows on
  // a list / profile are already cached), so the extra round-trips are rare.
  const missing = ids.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const fetched = await Promise.all(
      missing.map(async (id) => {
        try {
          const { data: show } = await supabase.functions.invoke<GetShowResponse>(
            'get-show',
            { body: { tmdb_show_id: id } },
          );
          return show ? { id, catalog: show.catalog } : null;
        } catch {
          return null;
        }
      }),
    );
    for (const f of fetched) {
      if (!f) continue;
      map.set(f.id, {
        tmdb_show_id: f.id,
        name: f.catalog?.name ?? 'Untitled',
        poster_path: f.catalog?.poster_path ?? null,
        backdrop_path: f.catalog?.backdrop_path ?? null,
        scopeArt: withArt ? buildScopeArt(f.catalog) : undefined,
      });
    }
  }

  return map;
}
