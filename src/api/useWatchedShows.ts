import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { WatchedCard } from '@/types';

const LIMIT = 60; // newest 60 distinct shows — pagination deferred (see plan)

/**
 * The "Shows" grid — every show the user has meaningfully watched, newest first.
 *
 * INCLUSION is broad (we trust the user to curate): a show appears if it has a
 * show-scope `watched` status, OR a show-scope rating, OR any watched episode.
 * This is the point of an episode-aware app — someone who watched 5 episodes
 * "has watched the show" even without a whole-show row. (See CLAUDE.md
 * "Aggregation: episode-aware schema, show-level UI".)
 *
 * DISPLAY is narrow: the gold star comes ONLY from a show-scope rating — we do
 * NOT average episode ratings into a show rating (separate product decision). A
 * show included only via episodes stays poster-only. The review badge reflects
 * any review for the show.
 *
 * `enabled` lets the screen fetch this lazily, only when the Shows tab opens.
 */
export function useWatchedShows(userId: string | undefined, enabled = true) {
  return useQuery<WatchedCard[]>({
    queryKey: ['watched', userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const id = userId!;

      // Three inclusion sources. Each capped at LIMIT by its own recency — the
      // global newest-LIMIT can only contain a show that's in some source's
      // newest-LIMIT, so this is enough to compute the union's top LIMIT.
      const [watchedRes, ratedRes, episodesRes] = await Promise.all([
        supabase
          .from('watch_status')
          .select('tmdb_show_id, updated_at')
          .eq('user_id', id)
          .eq('status', 'watched')
          .is('season_number', null)
          .is('episode_number', null)
          .order('updated_at', { ascending: false })
          .limit(LIMIT),
        supabase
          .from('ratings')
          .select('tmdb_show_id, score, created_at')
          .eq('user_id', id)
          .is('season_number', null)
          .is('episode_number', null)
          .order('created_at', { ascending: false })
          .limit(LIMIT),
        supabase
          .from('watch_status')
          .select('tmdb_show_id, updated_at')
          .eq('user_id', id)
          .eq('status', 'watched')
          .not('episode_number', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(LIMIT),
      ]);
      if (watchedRes.error) throw watchedRes.error;
      if (ratedRes.error) throw ratedRes.error;
      if (episodesRes.error) throw episodesRes.error;

      // recency: a show's sort key is the newest timestamp across any signal.
      // ratingByShow: show-scope rating only (drives the star overlay).
      const recency = new Map<number, number>();
      const ratingByShow = new Map<number, number>();
      const bump = (showId: number, ts: string) => {
        const t = Date.parse(ts);
        const prev = recency.get(showId);
        if (prev == null || t > prev) recency.set(showId, t);
      };

      for (const r of watchedRes.data ?? []) bump(r.tmdb_show_id, r.updated_at);
      for (const r of episodesRes.data ?? []) bump(r.tmdb_show_id, r.updated_at);
      for (const r of ratedRes.data ?? []) {
        bump(r.tmdb_show_id, r.created_at);
        ratingByShow.set(r.tmdb_show_id, r.score);
      }

      const ids = [...recency.keys()]
        .sort((a, b) => recency.get(b)! - recency.get(a)!)
        .slice(0, LIMIT);
      if (ids.length === 0) return [];

      const [cards, reviewedIds] = await Promise.all([
        fetchShowCards(ids),
        reviewedShowIds(id, ids),
      ]);

      return ids.map((sid) => {
        const card = cards.get(sid);
        return {
          tmdb_show_id: sid,
          name: card?.name ?? 'Untitled',
          poster_path: card?.poster_path ?? null,
          rating: ratingByShow.get(sid) ?? null,
          hasReview: reviewedIds.has(sid),
        };
      });
    },
  });
}

// Any-scope review counts toward the badge — a review of any part of the show
// means "you wrote about this", which is what the badge communicates.
async function reviewedShowIds(userId: string, showIds: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  const { data, error } = await supabase
    .from('reviews')
    .select('tmdb_show_id')
    .eq('user_id', userId)
    .in('tmdb_show_id', showIds);
  if (error) throw error;
  for (const r of (data ?? []) as { tmdb_show_id: number }[]) out.add(r.tmdb_show_id);
  return out;
}
