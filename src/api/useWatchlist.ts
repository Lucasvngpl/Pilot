import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { ShowCard, WatchStatusRow } from '@/types';

const LIMIT = 60; // newest 60 — pagination is deferred (see plan)

/**
 * The "Watchlist" grid — shows the user added to their watchlist (whole-show
 * scope), newest first. No rating/review overlays (these aren't watched yet).
 * `enabled` lets the screen fetch lazily, only when the Watchlist tab opens.
 */
export function useWatchlist(userId: string | undefined, enabled = true) {
  return useQuery<ShowCard[]>({
    queryKey: ['watchlist', userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const id = userId!;
      const { data: statusRows, error } = await supabase
        .from('watch_status')
        .select('tmdb_show_id, updated_at')
        .eq('user_id', id)
        .eq('status', 'watchlist')
        .is('season_number', null)
        .is('episode_number', null)
        .order('updated_at', { ascending: false })
        .limit(LIMIT);
      if (error) throw error;

      const rows = (statusRows ?? []) as Pick<WatchStatusRow, 'tmdb_show_id' | 'updated_at'>[];
      const ids = rows.map((r) => r.tmdb_show_id);
      if (ids.length === 0) return [];

      const cards = await fetchShowCards(ids);
      return ids.map(
        (sid) => cards.get(sid) ?? { tmdb_show_id: sid, name: 'Untitled', poster_path: null },
      );
    },
  });
}
