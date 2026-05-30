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
      return data;
    },
  });
}
