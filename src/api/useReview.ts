// useReview — load ONE review by id for the composer's edit mode, including drafts (which get-reviews now hides) + the author's rating for its scope.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type ReviewForEdit = {
  id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  is_draft: boolean;
  rating: number | null; // the author's rating for this EXACT scope, if any
};

// Reads the review row DIRECTLY by id. The owner can SELECT their own rows under
// the public-SELECT policy, so this loads DRAFTS too — unlike get-reviews, which
// now excludes them. Used only by the composer in edit mode (?reviewId=). Also
// fetches the rating for the review's exact scope so the stars pre-fill.
export function useReview(reviewId: string | undefined) {
  return useQuery<ReviewForEdit | null>({
    queryKey: ['review', reviewId],
    enabled: !!reviewId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('id, user_id, tmdb_show_id, season_number, episode_number, body, contains_spoilers, is_draft')
        .eq('id', reviewId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const r = data as {
        id: string; user_id: string; tmdb_show_id: number;
        season_number: number | null; episode_number: number | null;
        body: string; contains_spoilers: boolean; is_draft: boolean;
      };

      // Rating for this EXACT scope. Nullable scope → .is(null), else .eq(n) —
      // never match scope with NULL≠NULL.
      let q = supabase
        .from('ratings')
        .select('score')
        .eq('user_id', r.user_id)
        .eq('tmdb_show_id', r.tmdb_show_id);
      q = r.season_number === null ? q.is('season_number', null) : q.eq('season_number', r.season_number);
      q = r.episode_number === null ? q.is('episode_number', null) : q.eq('episode_number', r.episode_number);
      const { data: ratingRow } = await q.maybeSingle();

      return {
        id: r.id,
        tmdb_show_id: r.tmdb_show_id,
        season_number: r.season_number,
        episode_number: r.episode_number,
        body: r.body,
        contains_spoilers: r.contains_spoilers,
        is_draft: r.is_draft,
        rating: (ratingRow as { score: number } | null)?.score ?? null,
      };
    },
  });
}
