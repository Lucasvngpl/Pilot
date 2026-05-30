import { supabase } from '@/lib/supabase';
import type { ShowCard, TmdbPayload } from '@/types';

/**
 * Look up catalog cards (name + poster) for a set of show ids.
 *
 * Why a separate fetch instead of a PostgREST join: `shows_cache` has no foreign
 * key from `watch_status` / `ratings` (those reference `profiles`, and the show
 * id is just an int), so PostgREST can't embed the poster in one query. We fetch
 * the catalog blobs for the ids we already have and return a lookup map; callers
 * merge in JS — the same explicit-merge discipline get-reviews uses.
 *
 * This reads our OWN cache table (public SELECT) and never calls TMDb, so it
 * stays within the "catalog via Edge Functions" rule — that rule exists to keep
 * the TMDb *key* server-side, which this code never touches.
 */
export async function fetchShowCards(ids: number[]): Promise<Map<number, ShowCard>> {
  const map = new Map<number, ShowCard>();
  if (ids.length === 0) return map;

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
    });
  }
  return map;
}
