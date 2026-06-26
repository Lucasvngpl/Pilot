import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchBlockedIds } from '@/api/blocks';
import type { PersonResult } from '@/types';

/**
 * People search — a direct `profiles` query (RLS public SELECT), no Edge
 * Function: it's social data and never touches TMDb. Username match only, per
 * spec. `query` MUST be the debounced value (queryKey + enabled both key off it).
 *
 * Block-filtered: a user I've blocked never appears in my search results (no
 * re-discovering them to re-follow). Keyed by viewer so a blocker and a
 * non-blocker don't share the same cached result set.
 */
export function useSearchPeople(query: string) {
  const q = query.trim();
  const { user } = useAuth();
  const myId = user?.id;
  return useQuery<PersonResult[]>({
    queryKey: ['searchPeople', q, myId],
    enabled: q.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .ilike('username', `%${q}%`)
        .limit(20);
      if (error) throw error;
      const blocked = await fetchBlockedIds(myId);
      return ((data ?? []) as PersonResult[]).filter((p) => !blocked.has(p.id));
    },
  });
}
