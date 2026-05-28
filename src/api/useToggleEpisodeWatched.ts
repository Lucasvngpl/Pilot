import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { GetShowResponse, WatchStatusRow } from '@/types';

type ToggleArgs = {
  tmdb_show_id: number;
  season_number: number;
  episode_number: number;
  // Pre-mutation state from the call site. We pass it in (not re-read here)
  // because onMutate optimistically flips the cache before mutationFn runs —
  // an in-hook re-read would see the new state and pick the wrong branch.
  currentlyWatched: boolean;
};

// Episode-scope ONLY. Delete-on-unwatch is correct here (episodes are binary).
// Show / season scope needs a 3-state cycle — separate hook.

// Per-episode in-flight guard against the double-tap race.
const inFlight = new Set<string>();
const keyOf = (a: ToggleArgs) => `${a.tmdb_show_id}:${a.season_number}:${a.episode_number}`;

export function useToggleEpisodeWatched(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryKey = ['show', tmdbShowId] as const;

  const mutation = useMutation({
    mutationFn: async (args: ToggleArgs) => {
      if (!user) throw new Error('useToggleEpisodeWatched: no authenticated user');
      const userId = user.id;

      if (args.currentlyWatched) {
        // Composite-key delete — never by row id (could be an optimistic
        // placeholder). Unique constraint guarantees at most one match.
        const { error } = await supabase
          .from('watch_status')
          .delete()
          .eq('user_id', userId)
          .eq('tmdb_show_id', args.tmdb_show_id)
          .eq('season_number', args.season_number)
          .eq('episode_number', args.episode_number);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('watch_status').upsert(
          {
            user_id: userId,
            tmdb_show_id: args.tmdb_show_id,
            season_number: args.season_number,
            episode_number: args.episode_number,
            status: 'watched',
          },
          { onConflict: 'user_id,tmdb_show_id,season_number,episode_number' },
        );
        if (error) throw error;
      }
    },

    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<GetShowResponse>(queryKey);
      if (!prev) return { prevStatuses: null };

      const matches = (r: WatchStatusRow) =>
        r.season_number === args.season_number && r.episode_number === args.episode_number;

      const nextStatuses = args.currentlyWatched
        ? prev.mySocial.watch_statuses.filter((r) => !matches(r))
        : [
            ...prev.mySocial.watch_statuses,
            {
              id: `optimistic-${Date.now()}`,
              user_id: user!.id,
              tmdb_show_id: args.tmdb_show_id,
              season_number: args.season_number,
              episode_number: args.episode_number,
              status: 'watched',
              updated_at: new Date().toISOString(),
            } satisfies WatchStatusRow,
          ];

      qc.setQueryData<GetShowResponse>(queryKey, {
        ...prev,
        mySocial: { ...prev.mySocial, watch_statuses: nextStatuses },
      });

      // Snapshot ONLY the watch_statuses slice (see useRate for rationale).
      return { prevStatuses: prev.mySocial.watch_statuses };
    },

    onError: (err, _args, ctx) => {
      console.error('[useToggleEpisodeWatched] write failed:', err);
      if (ctx?.prevStatuses) {
        qc.setQueryData<GetShowResponse>(queryKey, (curr) =>
          curr ? { ...curr, mySocial: { ...curr.mySocial, watch_statuses: ctx.prevStatuses! } } : curr,
        );
      }
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey });
    },
  });

  const toggle = async (args: ToggleArgs) => {
    const k = keyOf(args);
    if (inFlight.has(k)) return;
    inFlight.add(k);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      await mutation.mutateAsync(args);
    } catch {
      // onError already logged + restored.
    } finally {
      inFlight.delete(k);
    }
  };

  return { toggle, isPending: mutation.isPending };
}
