import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { PersonResult } from '@/types';

/**
 * Everyone who watched or is watching a show, as people-rows, with the people
 * the caller follows sorted to the top (a follow-discovery surface). Public read
 * — the same watch_status set the VIEWERS stat counts. NOT the reviews list.
 */
export function useShowViewers(tmdbShowId: number | undefined) {
  const { user } = useAuth();
  const myId = user?.id;
  return useQuery<PersonResult[]>({
    queryKey: ['showViewers', tmdbShowId, myId],
    enabled: typeof tmdbShowId === 'number' && tmdbShowId > 0,
    queryFn: async () => {
      const { data: ws, error } = await supabase
        .from('watch_status')
        .select('user_id')
        .eq('tmdb_show_id', tmdbShowId)
        .in('status', ['watched', 'watching']);
      if (error) throw error;
      const ids = [...new Set((ws ?? []).map((w) => w.user_id as string))];
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url')
        .in('id', ids);
      if (pErr) throw pErr;

      // Which of these viewers do I follow? Drives followed-to-top sorting.
      let followed = new Set<string>();
      if (myId) {
        const { data: f } = await supabase
          .from('follows')
          .select('followee_id')
          .eq('follower_id', myId)
          .in('followee_id', ids);
        followed = new Set(((f ?? []) as { followee_id: string }[]).map((x) => x.followee_id));
      }

      const people = (profiles ?? []) as PersonResult[];
      return [...people].sort((a, b) => {
        const af = followed.has(a.id) ? 0 : 1;
        const bf = followed.has(b.id) ? 0 : 1;
        return af !== bf ? af - bf : a.username.localeCompare(b.username);
      });
    },
  });
}
