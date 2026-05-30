import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { GetShowResponse, WatchStatus, WatchStatusRow } from '@/types';

type Args = { tmdb_show_id: number; status: WatchStatus };

// Show-scope status setter. UPSERT-only (status values aren't binary like
// episode-watched — tapping a different pill switches; no toggle-off in v1).
const inFlight = new Set<number>();

export function useSetWatchStatus(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryKey = ['show', tmdbShowId] as const;

  const isShowScope = (r: WatchStatusRow) =>
    r.season_number === null && r.episode_number === null;

  const mutation = useMutation({
    mutationFn: async (args: Args) => {
      if (!user) throw new Error('useSetWatchStatus: no authenticated user');
      const userId = user.id;
      const { error } = await supabase.from('watch_status').upsert(
        {
          user_id: userId,
          tmdb_show_id: args.tmdb_show_id,
          season_number: null,
          episode_number: null,
          status: args.status,
        },
        { onConflict: 'user_id,tmdb_show_id,season_number,episode_number' },
      );
      if (error) throw error;
    },

    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<GetShowResponse>(queryKey);
      if (!prev) return { prevStatuses: null };

      const existing = prev.mySocial.watch_statuses.find(isShowScope);
      const nextStatuses = existing
        ? prev.mySocial.watch_statuses.map((r) =>
            isShowScope(r) ? { ...r, status: args.status, updated_at: new Date().toISOString() } : r,
          )
        : [
            ...prev.mySocial.watch_statuses,
            {
              id: `optimistic-${Date.now()}`,
              user_id: user!.id,
              tmdb_show_id: args.tmdb_show_id,
              season_number: null,
              episode_number: null,
              status: args.status,
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
      console.error('[useSetWatchStatus] write failed:', err);
      if (ctx?.prevStatuses) {
        qc.setQueryData<GetShowResponse>(queryKey, (curr) =>
          curr ? { ...curr, mySocial: { ...curr.mySocial, watch_statuses: ctx.prevStatuses! } } : curr,
        );
      }
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey });
      // A status write moves the show between the Profile buckets (watched /
      // watching / watchlist). Those queries aren't mounted from the show screen,
      // so we INVALIDATE (mark stale) rather than refetch — they refetch when the
      // Profile tab next opens. Without this, adding to the watchlist here wouldn't
      // appear on Profile until the 5-min staleTime lapsed. Prefix keys match every
      // user's variant (['watchlist', userId] …); only our own rows are in cache.
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      qc.invalidateQueries({ queryKey: ['watched'] });
      qc.invalidateQueries({ queryKey: ['watching'] });
    },
  });

  const setStatus = async (status: WatchStatus) => {
    if (inFlight.has(tmdbShowId)) return;
    inFlight.add(tmdbShowId);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      await mutation.mutateAsync({ tmdb_show_id: tmdbShowId, status });
    } catch {
      // onError already logged + restored.
    } finally {
      inFlight.delete(tmdbShowId);
    }
  };

  return { setStatus, isPending: mutation.isPending };
}
