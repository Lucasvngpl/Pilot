import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { MyReviewEntry } from '@/types';

const LIMIT = 100; // newest 100 — pagination deferred

// Scope key for the JS cross-table merge. CLAUDE.md rule: never match scoped
// tables in SQL (NULL ≠ NULL silently drops whole-show rows).
const scopeKey = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

// Shared fetch for the signed-in user's own reviews, split by draft state:
//   drafts=false → PUBLISHED reviews (Profile › Reviews)
//   drafts=true  → DRAFT reviews     (Profile › Drafts)
// Same enrichment for both — show card (name + poster), the rating for each
// review's EXACT scope (string-key JS merge), and a like count.
async function fetchUserReviews(userId: string, drafts: boolean): Promise<MyReviewEntry[]> {
  const { data: rows, error } = await supabase
    .from('reviews')
    .select('id, tmdb_show_id, season_number, episode_number, body, contains_spoilers')
    .eq('user_id', userId)
    .eq('is_draft', drafts)
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
    supabase.from('ratings').select('tmdb_show_id, season_number, episode_number, score').eq('user_id', userId).in('tmdb_show_id', showIds),
    supabase.from('review_likes').select('review_id').in('review_id', reviewIds),
  ]);

  const ratingByScope = new Map<string, number>();
  for (const r of (ratingRes.data ?? []) as {
    tmdb_show_id: number; season_number: number | null; episode_number: number | null; score: number;
  }[]) {
    ratingByScope.set(scopeKey(r.tmdb_show_id, r.season_number, r.episode_number), r.score);
  }

  // Like counts: tally rows per review. Degrades to 0 on error rather than
  // failing the surface (review_likes is unused by the UI today).
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
}

/** The signed-in user's PUBLISHED reviews — Profile › Your record → Reviews. */
export function useMyReviews(userId: string | undefined) {
  return useQuery<MyReviewEntry[]>({
    queryKey: ['myReviews', userId],
    enabled: !!userId,
    queryFn: () => fetchUserReviews(userId!, false),
  });
}

/**
 * The signed-in user's DRAFT reviews — Profile › Your record → Drafts. Drafts are
 * filtered out of EVERY public review query; this is the one place they surface.
 */
export function useDraftReviews(userId: string | undefined) {
  return useQuery<MyReviewEntry[]>({
    queryKey: ['drafts', userId],
    enabled: !!userId,
    queryFn: () => fetchUserReviews(userId!, true),
  });
}
