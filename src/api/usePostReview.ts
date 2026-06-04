import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';

type Args = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  is_draft: boolean; // true = unpublished draft (filtered from all public queries)
};

// Review TEXT only. INSERT (reviews allow multiple per scope — no upsert).
// Ratings are written separately via useRate; this hook never touches them.
const inFlight = new Set<string>();
const keyOf = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

export function usePostReview(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async (args: Args) => {
      if (!user) throw new Error('usePostReview: no authenticated user');
      // A PUBLISHED rating-only "log" writes no review row (reviews.body has a
      // length>0 CHECK). A DRAFT may be empty — 0007 relaxed the CHECK to
      // `is_draft OR length(body) > 0` — so a rating-only draft still gets a row
      // and shows up in your Drafts.
      if (!args.is_draft && !args.body.trim()) return;

      // NOTE: materializing 'watched' is no longer done here. The Review-or-log
      // composer owns the watched-write now (via setWatched, at the chosen scope +
      // date, for every save), so it fires once regardless of rating/text/scope.
      const { error } = await supabase.from('reviews').insert({
        user_id: user.id,
        tmdb_show_id: args.tmdb_show_id,
        season_number: args.season_number,
        episode_number: args.episode_number,
        body: args.body.trim(),
        contains_spoilers: args.contains_spoilers,
        is_draft: args.is_draft,
      });
      if (error) throw error;
    },

    onError: (err) => {
      console.error('[usePostReview] write failed:', err);
    },

    onSettled: () => {
      // Reviews list + show query (which carries the user's own reviews/ratings).
      qc.invalidateQueries({ queryKey: ['reviews', tmdbShowId] });
      qc.invalidateQueries({ queryKey: ['show', tmdbShowId] });
      // A review paints the review badge on the Profile "Shows" tile → refetch it.
      qc.invalidateQueries({ queryKey: ['watched'] });
      // A new review shows up in Profile › Your record → Reviews (or Drafts).
      qc.invalidateQueries({ queryKey: ['myReviews'] });
      qc.invalidateQueries({ queryKey: ['drafts'] });
      // The composer's watched-write (setWatched) creates a dated Diary entry; the
      // composer also invalidates these, but keep ['diary'] here so the review
      // write is independently correct.
      qc.invalidateQueries({ queryKey: ['diary'] });
    },
  });

  // Returns true if the review persisted (or a duplicate write was already in
  // flight), false if login was dismissed or the write failed. The composer
  // awaits this to decide whether to navigate away or keep the user's typed
  // text on screen and warn them — see review.tsx onPost.
  const postReview = async (args: Omit<Args, 'tmdb_show_id'>): Promise<boolean> => {
    const k = keyOf(tmdbShowId, args.season_number, args.episode_number);
    if (inFlight.has(k)) return true; // already posting this scope — don't double-warn
    inFlight.add(k);
    try {
      const allowed = await requireAuth();
      if (!allowed) return false;
      await mutation.mutateAsync({ tmdb_show_id: tmdbShowId, ...args });
      return true;
    } catch {
      return false; // onError already logged
    } finally {
      inFlight.delete(k);
    }
  };

  return { postReview, isPending: mutation.isPending };
}
