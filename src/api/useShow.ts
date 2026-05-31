// useShow — fetch one show's full catalog + the caller's social rows (ratings, statuses, reviews) via the get-show Edge Function.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GetShowResponse } from '@/types';

// `enabled` guards against running the query before we have a valid id —
// route params are strings, so callers do `Number(id)` first and might pass
// NaN on the first render before navigation params resolve.
export function useShow(tmdbShowId: number | undefined) {
  return useQuery({
    queryKey: ['show', tmdbShowId],
    enabled: typeof tmdbShowId === 'number' && tmdbShowId > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<GetShowResponse>(
        'get-show',
        { body: { tmdb_show_id: tmdbShowId } },
      );
      if (error) throw error;
      if (!data) throw new Error('get-show returned no data');
      return data;
    },
  });
}
