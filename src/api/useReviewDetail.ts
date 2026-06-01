// useReviewDetail — everything the full-review page (/review/[id]) renders for
// ONE published review: the reviewer's identity + like count (a single embed,
// the same one get-reviews uses), the reviewer's rating for the review's EXACT
// scope, and the show card (name + poster + backdrop for the hero banner).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { ReviewDetail } from '@/types';

// The PostgREST embed shape. `profiles!reviews_user_id_fkey` is REQUIRED, not
// cosmetic: reviews→profiles has two FK paths (the author via reviews.user_id,
// the likers via review_likes.user_id), so naming the constraint pins the embed
// to the author — without it PostgREST throws PGRST201 ("more than one
// relationship"). `review_likes(count)` comes back as an aggregate array, so the
// count is at [0].count (same as get-reviews).
type EmbeddedReview = {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  review_likes: { count: number }[];
};

export function useReviewDetail(reviewId: string | undefined) {
  return useQuery<ReviewDetail | null>({
    queryKey: ['reviewDetail', reviewId],
    enabled: !!reviewId,
    queryFn: async () => {
      // PUBLISHED only. `is_draft=false` keeps this public page from ever
      // rendering a draft — RLS doesn't hide drafts on a by-id read, so without
      // the filter a deep link to a draft id would leak it. A draft / unknown id
      // resolves to null → "Review not found." Your own drafts open in the
      // composer instead, never here.
      const { data, error } = await supabase
        .from('reviews')
        .select(
          'id, user_id, tmdb_show_id, season_number, episode_number, body, contains_spoilers, created_at, profiles!reviews_user_id_fkey(username, display_name, avatar_url), review_likes(count)',
        )
        .eq('id', reviewId!)
        .eq('is_draft', false)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // supabase-js can't infer the embedded relations precisely from the select
      // string, so cast through unknown to the shape we know it returns.
      const r = data as unknown as EmbeddedReview;

      // The reviewer's rating for this EXACT scope. Nullable scope → .is(null),
      // else .eq(n) — never match scope with SQL NULL≠NULL (CLAUDE.md rule).
      let q = supabase
        .from('ratings')
        .select('score')
        .eq('user_id', r.user_id)
        .eq('tmdb_show_id', r.tmdb_show_id);
      q = r.season_number === null ? q.is('season_number', null) : q.eq('season_number', r.season_number);
      q = r.episode_number === null ? q.is('episode_number', null) : q.eq('episode_number', r.episode_number);

      // Rating and the show card are independent → fetch in parallel. fetchShowCards
      // reads shows_cache (and self-heals an uncached id via get-show) and now
      // carries backdrop_path for the hero.
      const [{ data: ratingRow }, cards] = await Promise.all([
        q.maybeSingle(),
        fetchShowCards([r.tmdb_show_id]),
      ]);
      const card = cards.get(r.tmdb_show_id);

      return {
        id: r.id,
        user_id: r.user_id,
        tmdb_show_id: r.tmdb_show_id,
        season_number: r.season_number,
        episode_number: r.episode_number,
        body: r.body,
        contains_spoilers: r.contains_spoilers,
        created_at: r.created_at,
        username: r.profiles?.username ?? 'unknown',
        display_name: r.profiles?.display_name ?? null,
        avatar_url: r.profiles?.avatar_url ?? null,
        likes: r.review_likes?.[0]?.count ?? 0,
        rating: (ratingRow as { score: number } | null)?.score ?? null,
        showName: card?.name ?? 'Untitled',
        posterPath: card?.poster_path ?? null,
        backdropPath: card?.backdrop_path ?? null,
      };
    },
  });
}
