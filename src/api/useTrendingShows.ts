import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SearchShowResult } from '@/types';

type TrendingRow = {
  tmdb_show_id: number;
  name: string | null;
  poster_path: string | null;
  first_air_date: string | null;
};

/**
 * Trending = the popular set from shows_cache, newest-refreshed first.
 *
 * We read shows_cache DIRECTLY and select only the slim fields via PostgREST
 * JSON extraction (`payload->>name`). Why not `get-popular`: it returns the
 * whole payload blob per show — ~16MB for 20 shows, and a 500 at 50 — which is
 * absurd for a poster list (and would spin forever). No TMDb call here, so a
 * direct cached-table read is fine (the catalog-via-Edge-Functions rule is about
 * the TMDb key, which this never touches). This response is ~2.5KB.
 */
export function useTrendingShows(limit = 20) {
  return useQuery<SearchShowResult[]>({
    queryKey: ['trending', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shows_cache')
        .select(
          'tmdb_show_id, name:payload->>name, poster_path:payload->>poster_path, first_air_date:payload->>first_air_date',
        )
        .eq('is_popular', true)
        .order('fetched_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data ?? []) as TrendingRow[]).map((r) => ({
        tmdb_show_id: r.tmdb_show_id,
        name: r.name ?? 'Untitled',
        poster_path: r.poster_path,
        first_air_date: r.first_air_date,
      }));
    },
  });
}
