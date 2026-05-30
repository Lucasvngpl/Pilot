import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { CurrentlyWatchingCard, WatchStatusRow } from '@/types';

/**
 * The Currently-watching shelf.
 *
 * INCLUSION = show-scope `watching` status (season & episode both null) — the
 * user explicitly told the app they're watching this show. We deliberately do
 * NOT infer "watching" from recent episode activity: a show marked done last
 * month must not linger here.
 *
 * The "S2 E5" line under each poster is a SEPARATE derivation — the latest
 * episode the user marked watched — so we can show where they are without
 * letting episode activity drive inclusion.
 */
export function useCurrentlyWatching(userId: string | undefined) {
  return useQuery<CurrentlyWatchingCard[]>({
    queryKey: ['watching', userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId!;
      const { data: statusRows, error } = await supabase
        .from('watch_status')
        .select('*')
        .eq('user_id', id)
        .eq('status', 'watching')
        .is('season_number', null)
        .is('episode_number', null)
        .order('updated_at', { ascending: false })
        .limit(60);
      if (error) throw error;

      const rows = (statusRows ?? []) as WatchStatusRow[];
      const ids = rows.map((r) => r.tmdb_show_id);
      if (ids.length === 0) return [];

      const [cards, episodeLines] = await Promise.all([
        fetchShowCards(ids),
        latestWatchedEpisodes(id, ids),
      ]);

      return rows.map((r) => {
        const card = cards.get(r.tmdb_show_id);
        return {
          tmdb_show_id: r.tmdb_show_id,
          name: card?.name ?? 'Untitled',
          poster_path: card?.poster_path ?? null,
          episodeLine: episodeLines.get(r.tmdb_show_id) ?? null,
        };
      });
    },
  });
}

/**
 * Latest watched EPISODE per show → "S{season} E{episode}". Episode-scope rows
 * only (episode_number not null), picking the highest (season, then episode).
 * Returns a map of show id → display line for shows that have any watched ep.
 */
async function latestWatchedEpisodes(
  userId: string,
  showIds: number[],
): Promise<Map<number, string>> {
  const { data, error } = await supabase
    .from('watch_status')
    .select('tmdb_show_id, season_number, episode_number')
    .eq('user_id', userId)
    .eq('status', 'watched')
    .in('tmdb_show_id', showIds)
    .not('episode_number', 'is', null);
  if (error) throw error;

  // Track the best (highest) episode seen per show. rank = season*1000 + episode
  // gives a single comparable number (assumes <1000 episodes per season — safe).
  const best = new Map<number, { rank: number; line: string }>();
  for (const row of (data ?? []) as WatchStatusRow[]) {
    const s = row.season_number ?? 0;
    const e = row.episode_number ?? 0;
    const rank = s * 1000 + e;
    const prev = best.get(row.tmdb_show_id);
    if (!prev || rank > prev.rank) {
      best.set(row.tmdb_show_id, { rank, line: `S${s} E${e}` });
    }
  }

  return new Map([...best].map(([showId, v]) => [showId, v.line]));
}
