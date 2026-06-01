import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';

// Edit + delete for one's own reviews. RLS (reviews_update_own / reviews_delete_own,
// 0001_init.sql) scopes both writes to the owner — no client-side owner check needed
// for safety, only to decide whether to SHOW the menu.

// Invalidate the same set usePostReview does: the reviews list, the show query
// (carries the caller's own reviews/ratings), and the Profile "Shows" grid (its
// tile shows a review badge).
function useInvalidateReview(tmdbShowId: number) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['reviews', tmdbShowId] });
    qc.invalidateQueries({ queryKey: ['show', tmdbShowId] });
    qc.invalidateQueries({ queryKey: ['watched'] });
    qc.invalidateQueries({ queryKey: ['myReviews'] }); // Profile › Your record → Reviews
  };
}

// Update one review's body + spoiler flag (by id). The body length>0 CHECK still
// applies — the composer disables Save on an empty body, so we never send blank.
export function useUpdateReview(tmdbShowId: number) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const invalidate = useInvalidateReview(tmdbShowId);

  const mutation = useMutation({
    mutationFn: async (
      { reviewId, body, contains_spoilers }:
        { reviewId: string; body: string; contains_spoilers: boolean },
    ) => {
      if (!user) throw new Error('useUpdateReview: no authenticated user');
      const { error } = await supabase
        .from('reviews')
        .update({ body: body.trim(), contains_spoilers })
        .eq('id', reviewId);
      if (error) throw error;
    },
    onSettled: invalidate,
  });

  // Returns true if saved, false on dismissed login OR a write error (the composer
  // keeps the user's text + warns on false — mirrors usePostReview).
  const update = async (reviewId: string, body: string, contains_spoilers: boolean): Promise<boolean> => {
    const allowed = await requireAuth();
    if (!allowed) return false;
    try {
      await mutation.mutateAsync({ reviewId, body, contains_spoilers });
      return true;
    } catch {
      return false;
    }
  };

  return { update, isPending: mutation.isPending };
}

// Delete one review. The show id is a per-CALL arg (not per-hook) so a single
// hook can delete reviews across DIFFERENT shows — the Profile "Reviews" list
// spans many. The delete itself is by review id; the show id only targets which
// ['reviews', id] / ['show', id] caches to invalidate.
export function useDeleteReview() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async ({ reviewId }: { reviewId: string; tmdbShowId: number }) => {
      if (!user) throw new Error('useDeleteReview: no authenticated user');
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
    },
    onSettled: (_data, _err, { tmdbShowId }) => {
      qc.invalidateQueries({ queryKey: ['reviews', tmdbShowId] });
      qc.invalidateQueries({ queryKey: ['show', tmdbShowId] });
      qc.invalidateQueries({ queryKey: ['watched'] });
      qc.invalidateQueries({ queryKey: ['myReviews'] });
    },
  });

  const remove = (reviewId: string, tmdbShowId: number) =>
    mutation.mutateAsync({ reviewId, tmdbShowId });

  return { remove, isPending: mutation.isPending };
}
