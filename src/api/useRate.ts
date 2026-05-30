import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { GetShowResponse, RatingRow } from '@/types';

// Scope defaults to whole show (both null). Pass season/episode for narrower scopes.
type Scope = { season_number?: number | null; episode_number?: number | null };
type Args = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  score: number | null; // null = clear
};

// Single rating-write path for ALL scopes (show / season / episode). UPSERT on
// set, DELETE on clear. The action sheet uses show scope; the review composer
// passes a narrower scope — both go through here.
const inFlight = new Set<string>();
const keyOf = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

function snapToHalfStar(n: number): number {
  const snapped = Math.round(n * 2) / 2;
  return Math.max(0.5, Math.min(5, snapped));
}

export function useRate(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryKey = ['show', tmdbShowId] as const;

  // Explicit === (incl. nulls) so a whole-show row (season/episode null) matches
  // a whole-show scope. SQL NULL≠NULL would miss it; JS === null does not.
  const isScope = (r: RatingRow, s: number | null, e: number | null) =>
    r.season_number === s && r.episode_number === e;

  const mutation = useMutation({
    mutationFn: async (args: Args) => {
      if (!user) throw new Error('useRate: no authenticated user');
      const userId = user.id;
      const safeScore = args.score === null ? null : snapToHalfStar(args.score);

      if (safeScore === null) {
        let q = supabase
          .from('ratings')
          .delete()
          .eq('user_id', userId)
          .eq('tmdb_show_id', args.tmdb_show_id);
        q = args.season_number === null ? q.is('season_number', null) : q.eq('season_number', args.season_number);
        q = args.episode_number === null ? q.is('episode_number', null) : q.eq('episode_number', args.episode_number);
        const { error } = await q;
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ratings').upsert(
          {
            user_id: userId,
            tmdb_show_id: args.tmdb_show_id,
            season_number: args.season_number,
            episode_number: args.episode_number,
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
      const match = (r: RatingRow) => isScope(r, args.season_number, args.episode_number);
      const existing = prev.mySocial.ratings.find(match);

      let nextRatings: RatingRow[];
      if (safeScore === null) {
        nextRatings = prev.mySocial.ratings.filter((r) => !match(r));
      } else if (existing) {
        nextRatings = prev.mySocial.ratings.map((r) => (match(r) ? { ...r, score: safeScore } : r));
      } else {
        nextRatings = [
          ...prev.mySocial.ratings,
          {
            id: `optimistic-${Date.now()}`,
            user_id: user!.id,
            tmdb_show_id: args.tmdb_show_id,
            season_number: args.season_number,
            episode_number: args.episode_number,
            score: safeScore,
            created_at: new Date().toISOString(),
          } satisfies RatingRow,
        ];
      }

      qc.setQueryData<GetShowResponse>(queryKey, {
        ...prev,
        mySocial: { ...prev.mySocial, ratings: nextRatings },
      });
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

  // Returns true if the write succeeded (or a duplicate was already in flight),
  // false if login was dismissed or the write failed. The action sheet ignores
  // this (fire-and-forget with optimistic rollback); the composer awaits it so
  // it doesn't navigate away after a silently-failed write.
  const rate = async (score: number | null, scope: Scope = {}): Promise<boolean> => {
    const season = scope.season_number ?? null;
    const episode = scope.episode_number ?? null;
    const k = keyOf(tmdbShowId, season, episode);
    if (inFlight.has(k)) return true;
    inFlight.add(k);
    try {
      const allowed = await requireAuth();
      if (!allowed) return false;
      await mutation.mutateAsync({
        tmdb_show_id: tmdbShowId,
        season_number: season,
        episode_number: episode,
        score,
      });
      return true;
    } catch {
      return false; // onError already logged + restored
    } finally {
      inFlight.delete(k);
    }
  };

  return { rate, isPending: mutation.isPending };
}
