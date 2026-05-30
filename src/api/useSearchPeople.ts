import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PersonResult } from '@/types';

/**
 * People search — a direct `profiles` query (RLS public SELECT), no Edge
 * Function: it's social data and never touches TMDb. Username match only, per
 * spec. `query` MUST be the debounced value (queryKey + enabled both key off it).
 */
export function useSearchPeople(query: string) {
  const q = query.trim();
  return useQuery<PersonResult[]>({
    queryKey: ['searchPeople', q],
    enabled: q.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as PersonResult[];
    },
  });
}
