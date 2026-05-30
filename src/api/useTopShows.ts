import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { ShowCard } from '@/types';

/**
 * A user's "Top 4" favorite shows, in slot order (position ascending). Mirrors
 * useWatchlist: read the lightweight ref rows from profile_top_shows, then
 * fetchShowCards to fill in name + poster (it lazy-caches any uncached show).
 * Works for any user (own profile + another user's). `enabled` lets the Profile
 * fetch eagerly (Top-4 is on the default Profile tab, not behind a sub-tab).
 */
export function useTopShows(userId: string | undefined, enabled = true) {
  return useQuery<ShowCard[]>({
    queryKey: ['topShows', userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const id = userId!;
      const { data, error } = await supabase
        .from('profile_top_shows')
        .select('tmdb_show_id, position')
        .eq('user_id', id)
        .order('position', { ascending: true });
      if (error) throw error;

      const ids = (data ?? []).map((r) => (r as { tmdb_show_id: number }).tmdb_show_id);
      if (ids.length === 0) return [];

      const cards = await fetchShowCards(ids);
      // Preserve position order; fall back to a poster-less tile if a card is missing.
      return ids.map(
        (sid) => cards.get(sid) ?? { tmdb_show_id: sid, name: 'Untitled', poster_path: null },
      );
    },
  });
}
