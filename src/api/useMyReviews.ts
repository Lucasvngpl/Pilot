import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { MyReviewEntry } from '@/types';

const LIMIT = 100; // newest 100 reviews — pagination deferred

// Scope key for the JS cross-table merge. CLAUDE.md rule: never match scoped
// tables in SQL (NULL ≠ NULL silently drops whole-show rows). A string key
// serializes null consistently on both sides.
const scopeKey = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

/**
 * The signed-in user's OWN posted reviews, newest first — the "Reviews" surface
 * in Profile › Your record. Like useDiary, this fetches the bare rows then
 * enriches in JS: show card (name + poster) via fetchShowCards, the user's
 * rating for each review's EXACT scope (string-key merge), and a like count.
 */
export function useMyReviews(userId: string | undefined) {
  return useQuery<MyReviewEntry[]>({
    queryKey: ['myReviews', userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId!;

      const { data: rows, error } = await supabase
        .from('reviews')
        .select('id, tmdb_show_id, season_number, episode_number, body, contains_spoilers, created_at')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (error) throw error;

      const reviews = (rows ?? []) as {
        id: string;
        tmdb_show_id: number;
        season_number: number | null;
        episode_number: number | null;
        body: string;
        contains_spoilers: boolean;
      }[];
      if (reviews.length === 0) return [];

      const showIds = [...new Set(reviews.map((r) => r.tmdb_show_id))];
      const reviewIds = reviews.map((r) => r.id);

      const [cards, ratingRes, likesRes] = await Promise.all([
        fetchShowCards(showIds), // name + poster (lazy-caches any uncached show)
        supabase.from('ratings').select('tmdb_show_id, season_number, episode_number, score').eq('user_id', id).in('tmdb_show_id', showIds),
        supabase.from('review_likes').select('review_id').in('review_id', reviewIds),
      ]);

      const ratingByScope = new Map<string, number>();
      for (const r of (ratingRes.data ?? []) as {
        tmdb_show_id: number; season_number: number | null; episode_number: number | null; score: number;
      }[]) {
        ratingByScope.set(scopeKey(r.tmdb_show_id, r.season_number, r.episode_number), r.score);
      }

      // Like counts: tally rows per review. review_likes is unused by the UI
      // today, so this is usually empty; we never throw on its error (no
      // `likesRes.error` check) — a missing count just degrades to 0 likes
      // rather than failing the whole surface.
      const likesByReview = new Map<string, number>();
      for (const l of (likesRes.data ?? []) as { review_id: string }[]) {
        likesByReview.set(l.review_id, (likesByReview.get(l.review_id) ?? 0) + 1);
      }

      return reviews.map((r): MyReviewEntry => {
        const card = cards.get(r.tmdb_show_id);
        return {
          id: r.id,
          tmdb_show_id: r.tmdb_show_id,
          season_number: r.season_number,
          episode_number: r.episode_number,
          body: r.body,
          contains_spoilers: r.contains_spoilers,
          showName: card?.name ?? 'Untitled',
          posterPath: card?.poster_path ?? null,
          rating: ratingByScope.get(scopeKey(r.tmdb_show_id, r.season_number, r.episode_number)) ?? null,
          likes: likesByReview.get(r.id) ?? 0,
        };
      });
    },
  });
}
