import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SearchShowResult } from '@/types';

type GenreRow = {
  tmdb_show_id: number;
  name: string | null;
  poster_path: string | null;
  first_air_date: string | null;
};

/**
 * Shows in our cache that belong to a genre — powers the Search genre browse.
 *
 * Same slim, no-TMDb-call read as useTrendingShows: select only the poster-row
 * fields via PostgREST JSON extraction, so the response is tiny and rows render
 * identically to trending/search rows (SearchShowResult).
 *
 * The genre filter is a JSONB **containment** check —
 * `(payload->genres) @> [{"id": <genreId>}]` — expressed via PostgREST's `cs`
 * operator on the json path (`payload->genres=cs.[{"id":N}]`, verified against the
 * live cache). We match by genre **id** (canonical), never name (localizable).
 * No `is_popular` gate: a genre browse should surface EVERY cached show of that
 * genre, not just the popular shelf.
 *
 * Cache-only (Option A): results are bounded to shows already cached (~225 — the
 * popular set + anything anyone has opened). Mainstream genres are well-covered;
 * niche ones (Documentary, Western) are sparse until the catalog grows — that's
 * the signal to add a TMDb `/discover` Edge Function (Option B) if it ever feels
 * too thin. `enabled` off when no genre is selected (trending shows instead).
 */
export function useShowsByGenre(genreId: number | null, limit = 40) {
  return useQuery<SearchShowResult[]>({
    queryKey: ['showsByGenre', genreId, limit],
    enabled: genreId !== null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shows_cache')
        .select(
          'tmdb_show_id, name:payload->>name, poster_path:payload->>poster_path, first_air_date:payload->>first_air_date',
        )
        // `cs` = contains (@>). The value is the JSON array we test for inside
        // payload->genres; supabase-js URL-encodes it. .filter() passes it through
        // verbatim, so it's exactly the query proven via curl.
        .filter('payload->genres', 'cs', JSON.stringify([{ id: genreId }]))
        .order('fetched_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as GenreRow[]).map((r) => ({
        tmdb_show_id: r.tmdb_show_id,
        name: r.name ?? 'Untitled',
        poster_path: r.poster_path,
        first_air_date: r.first_air_date,
      }));
    },
  });
}
