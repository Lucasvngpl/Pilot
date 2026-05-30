import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GetReviewsResponse } from '@/types';

// All reviews for a show (newest first), enriched server-side with reviewer
// profile + like count + rating. Public — works signed-out.
export function usePopularReviews(tmdbShowId: number | undefined) {
  return useQuery({
    queryKey: ['reviews', tmdbShowId],
    enabled: typeof tmdbShowId === 'number' && tmdbShowId > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<GetReviewsResponse>(
        'get-reviews',
        { body: { tmdb_show_id: tmdbShowId } },
      );
      if (error) throw error;
      if (!data) throw new Error('get-reviews returned no data');
      return data;
    },
  });
}
