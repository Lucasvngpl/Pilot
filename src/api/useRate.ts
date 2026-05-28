import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { GetShowResponse, RatingRow } from '@/types';

type Args = {
  tmdb_show_id: number;
  score: number | null; // null = clear
};

// Show-scope rating. UPSERT on set (0.5..5.0 in 0.5 steps), DELETE on clear.
const inFlight = new Set<number>();

// Snap to nearest half-star, clamp to [0.5, 5.0]. Defensive — the picker
// already emits valid values; this closes the door on programmatic callers.
function snapToHalfStar(n: number): number {
  const snapped = Math.round(n * 2) / 2;
  return Math.max(0.5, Math.min(5, snapped));
}

export function useRate(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryKey = ['show', tmdbShowId] as const;

  const isShowScope = (r: RatingRow) =>
    r.season_number === null && r.episode_number === null;

  const mutation = useMutation({
    mutationFn: async (args: Args) => {
      // Defensive: session can change between requireAuth resolving and here.
      if (!user) throw new Error('useRate: no authenticated user');
      const userId = user.id;
      const safeScore = args.score === null ? null : snapToHalfStar(args.score);

      if (safeScore === null) {
        const { error } = await supabase
          .from('ratings')
          .delete()
          .eq('user_id', userId)
          .eq('tmdb_show_id', args.tmdb_show_id)
          .is('season_number', null)
          .is('episode_number', null);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ratings').upsert(
          {
            user_id: userId,
            tmdb_show_id: args.tmdb_show_id,
            season_number: null,
            episode_number: null,
            score: safeScore,
          },
          { onConflict: 'user_id,tmdb_show_id,season_number,episode_number' },
        );
        if (error) throw error;
      }
    },

    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<GetShowResponse>(queryKey);
      if (!prev) return { prevRatings: null };

      const safeScore = args.score === null ? null : snapToHalfStar(args.score);
      const existing = prev.mySocial.ratings.find(isShowScope);

      let nextRatings: RatingRow[];
      if (safeScore === null) {
        nextRatings = prev.mySocial.ratings.filter((r) => !isShowScope(r));
      } else if (existing) {
        nextRatings = prev.mySocial.ratings.map((r) =>
          isShowScope(r) ? { ...r, score: safeScore } : r,
        );
      } else {
        nextRatings = [
          ...prev.mySocial.ratings,
          {
            id: `optimistic-${Date.now()}`,
            user_id: user!.id,
            tmdb_show_id: args.tmdb_show_id,
            season_number: null,
            episode_number: null,
            score: safeScore,
            created_at: new Date().toISOString(),
          } satisfies RatingRow,
        ];
      }

      qc.setQueryData<GetShowResponse>(queryKey, {
        ...prev,
        mySocial: { ...prev.mySocial, ratings: nextRatings },
      });

      // Snapshot ONLY the ratings slice — a concurrent watch_status mutation
      // restores its own slice, so the two don't clobber each other on error.
      return { prevRatings: prev.mySocial.ratings };
    },

    onError: (err, _args, ctx) => {
      console.error('[useRate] write failed:', err);
      if (ctx?.prevRatings) {
        qc.setQueryData<GetShowResponse>(queryKey, (curr) =>
          curr ? { ...curr, mySocial: { ...curr.mySocial, ratings: ctx.prevRatings! } } : curr,
        );
      }
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey });
    },
  });

  const rate = async (score: number | null) => {
    if (inFlight.has(tmdbShowId)) return;
    inFlight.add(tmdbShowId);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      await mutation.mutateAsync({ tmdb_show_id: tmdbShowId, score });
    } catch {
      // onError already logged + restored.
    } finally {
      inFlight.delete(tmdbShowId);
    }
  };

  return { rate, isPending: mutation.isPending };
}
