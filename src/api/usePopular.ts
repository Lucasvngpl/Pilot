import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { GetPopularResponse } from '@/types';

// Calls the get-popular Edge Function. supabase-js appends the functionName
// string verbatim to the URL, so `name?key=value` puts the limit in the query.
export function usePopular(limit = 50) {
  return useQuery({
    queryKey: ['popular', limit],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<GetPopularResponse>(
        `get-popular?limit=${limit}`,
      );
      if (error) throw error;
      if (!data) throw new Error('get-popular returned no data');
      return data;
    },
  });
}
