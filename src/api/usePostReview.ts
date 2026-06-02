import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import { markShowWatched } from '@/api/markShowWatched';

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

      // TASK 1: publishing a SHOW-scope review materializes watched — this is the
      // path that catches a text-only review with NO star (useRate never fires).
      // Drafts don't: a private draft isn't a "log" yet (it marks watched on
      // publish, or immediately if it also carried a rating via useRate). Written
      // before the insert so a partial failure leaves the harmless state.
      if (!args.is_draft && args.season_number === null && args.episode_number === null) {
        await markShowWatched(user.id, args.tmdb_show_id);
      }

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

    onSettled: (_d, _e, args) => {
      // Reviews list + show query (which carries the user's own reviews/ratings).
      qc.invalidateQueries({ queryKey: ['reviews', tmdbShowId] });
      qc.invalidateQueries({ queryKey: ['show', tmdbShowId] });
      // A review paints the review badge on the Profile "Shows" tile → refetch it.
      qc.invalidateQueries({ queryKey: ['watched'] });
      // A new review shows up in Profile › Your record → Reviews (or Drafts).
      qc.invalidateQueries({ queryKey: ['myReviews'] });
      qc.invalidateQueries({ queryKey: ['drafts'] });
      // Publishing a show-scope review may have materialized 'watched' (TASK 1),
      // superseding a prior watching/watchlist row → refresh those shelves too.
      if (!args.is_draft && args.season_number === null && args.episode_number === null) {
        qc.invalidateQueries({ queryKey: ['watching'] });
        qc.invalidateQueries({ queryKey: ['watchlist'] });
      }
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
