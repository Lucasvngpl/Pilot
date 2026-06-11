import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { WatchedCard } from '@/types';

const LIMIT = 60; // newest 60 distinct shows — pagination deferred (see plan)

// Which shows the "Shows" tab includes:
//   'watched'  → finished (show-scope watch_status = 'watched')
//   'watching' → in progress (show-scope watch_status = 'watching')
//   null       → the loose "everything you've touched" pile (broad union)
// Watched/Watching are clean status queries — that's the payoff of TASK 1
// materializing 'watched' as a real field. `null` keeps the old read-time union,
// reached on the Shows tab by deselecting both chips (Option A: no "All" chip).
export type WatchedFilter = 'watched' | 'watching' | null;

/**
 * The "Shows" grid, newest first. INCLUSION depends on `filter` (above).
 *
 * DISPLAY is the same for all three: the gold star comes ONLY from a show-scope
 * rating (we never average episode ratings into a show rating — separate product
 * decision); the review badge reflects any review for the show. A show included
 * via the loose union with no show-scope rating stays poster-only.
 *
 * `enabled` lets a screen fetch lazily. The Profile passes the active filter for
 * the grid AND a fixed 'watched' query for the tab/record count — identical key
 * when the filter is 'watched', so React Query shares the one fetch.
 */
export function useWatchedShows(
  userId: string | undefined,
  filter: WatchedFilter = null,
  enabled = true,
) {
  return useQuery<WatchedCard[]>({
    // filter is part of the key so the three views cache independently.
    queryKey: ['watched', userId, filter],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const id = userId!;

      // recency: a show's sort key is the newest timestamp across its signals.
      // ratingByShow: show-scope rating only (drives the gold star overlay).
      const recency = new Map<number, number>();
      const ratingByShow = new Map<number, number>();
      const bump = (showId: number, ts: string) => {
        const t = Date.parse(ts);
        const prev = recency.get(showId);
        if (prev == null || t > prev) recency.set(showId, t);
      };
      // The user's chosen show-scope watched_at OVERWRITES (not max-merges) recency:
      // when you've logged the whole show on a specific day, that day is the truth
      // for where it sits in the grid — a same-day rating or a recent episode tick
      // must NOT float it back up. Called LAST below, so the overwrite always wins.
      const setAuthoritative = (showId: number, day: string) => {
        recency.set(showId, Date.parse(day));
      };

      if (filter === null) {
        // ALL — broad union: show-scope watched OR show-scope rating OR any
        // watched episode. Ratings here double as an inclusion source AND the
        // star value. Each source capped at LIMIT by its own recency — the
        // global newest-LIMIT can only contain a show in some source's top LIMIT.
        const [watchedRes, ratedRes, episodesRes] = await Promise.all([
          supabase.from('watch_status')
            .select('tmdb_show_id, watched_at, updated_at')
            .eq('user_id', id).eq('status', 'watched')
            .is('season_number', null).is('episode_number', null)
            .order('watched_at', { ascending: false }).order('updated_at', { ascending: false }).limit(LIMIT),
          supabase.from('ratings')
            .select('tmdb_show_id, score, created_at')
            .eq('user_id', id)
            .is('season_number', null).is('episode_number', null)
            .order('created_at', { ascending: false }).limit(LIMIT),
          supabase.from('watch_status')
            .select('tmdb_show_id, watched_at')
            .eq('user_id', id).eq('status', 'watched')
            .not('episode_number', 'is', null)
            .order('watched_at', { ascending: false }).limit(LIMIT),
        ]);
        if (watchedRes.error) throw watchedRes.error;
        if (ratedRes.error) throw ratedRes.error;
        if (episodesRes.error) throw episodesRes.error;

        // Non-authoritative signals first (rating recency + episode ticks), then the
        // show-scope watched day overwrites — so the user's chosen date wins for any
        // show they've logged whole, while shows known only by a stray rating/episode
        // (no chosen date) keep the loose newest-signal recency.
        for (const r of ratedRes.data ?? []) {
          bump(r.tmdb_show_id, r.created_at);
          ratingByShow.set(r.tmdb_show_id, r.score);
        }
        for (const r of episodesRes.data ?? []) bump(r.tmdb_show_id, r.watched_at);
        // watched_at is NULL for backlog marks (undated) — fall back to updated_at
        // (when it was marked) so they sort by mark-time instead of NaN.
        for (const r of watchedRes.data ?? []) setAuthoritative(r.tmdb_show_id, r.watched_at ?? r.updated_at);
      } else {
        // WATCHED or WATCHING — one clean show-scope status query.
        // 'watched' sorts by the chosen watch day (updated_at as the intra-day
        // tiebreak); 'watching' has no watch day, so it keeps its old "recently
        // touched first" order on updated_at.
        const base = supabase.from('watch_status')
          .select('tmdb_show_id, watched_at, updated_at')
          .eq('user_id', id).eq('status', filter)
          .is('season_number', null).is('episode_number', null);
        const ordered = filter === 'watched'
          ? base.order('watched_at', { ascending: false }).order('updated_at', { ascending: false })
          : base.order('updated_at', { ascending: false });
        const { data, error } = await ordered.limit(LIMIT);
        if (error) throw error;
        // Backlog rows have NULL watched_at → fall back to updated_at (mark-time).
        for (const r of data ?? []) bump(r.tmdb_show_id, (filter === 'watched' ? r.watched_at : r.updated_at) ?? r.updated_at);
      }

      const ids = [...recency.keys()]
        .sort((a, b) => recency.get(b)! - recency.get(a)!)
        .slice(0, LIMIT);
      if (ids.length === 0) return [];

      // watched/watching didn't load ratings as an inclusion source — fetch the
      // show-scope score for the included shows so the star overlay still paints.
      if (filter !== null) {
        const { data: rated, error } = await supabase.from('ratings')
          .select('tmdb_show_id, score')
          .eq('user_id', id)
          .is('season_number', null).is('episode_number', null)
          .in('tmdb_show_id', ids);
        if (error) throw error;
        for (const r of rated ?? []) ratingByShow.set(r.tmdb_show_id, r.score);
      }

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
    .eq('is_draft', false) // a draft doesn't paint the "reviewed" badge
    .in('tmdb_show_id', showIds);
  if (error) throw error;
  for (const r of (data ?? []) as { tmdb_show_id: number }[]) out.add(r.tmdb_show_id);
  return out;
}
