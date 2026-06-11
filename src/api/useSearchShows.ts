import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SearchShowsResponse } from '@/types';

/**
 * Show search via the `search-shows` Edge Function (TMDb proxy).
 *
 * `query` MUST be the debounced value — both the queryKey and `enabled` key off
 * it, so we query on pause, not per keystroke. Disabled for a blank query.
 */
export function useSearchShows(query: string) {
  const q = query.trim();
  return useQuery<SearchShowsResponse>({
    queryKey: ['searchShows', q],
    enabled: q.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<SearchShowsResponse>(
        'search-shows',
        { body: { query: q } },
      );
      if (error) throw error;
      if (!data) throw new Error('search-shows returned no data');
      // TMDb's /search/tv can return the same show id more than once. Every
      // consumer renders rows keyed by tmdb_show_id (main search + the list
      // add-item picker), so a repeat would both render a duplicate row AND throw
      // React's "two children with the same key" warning (PIL-11). Dedupe by id,
      // preserving TMDb's relevance order (first occurrence wins).
      const seen = new Set<number>();
      const results = data.results.filter((r) =>
        seen.has(r.tmdb_show_id) ? false : (seen.add(r.tmdb_show_id), true),
      );
      return { ...data, results };
    },
  });
}
