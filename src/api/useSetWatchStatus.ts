import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { GetShowResponse, WatchStatus, WatchStatusRow } from '@/types';

// Scope defaults to whole show (both null). Pass season/episode for narrower scopes.
type Scope = { season_number?: number | null; episode_number?: number | null };
type Args = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  status: WatchStatus;
};

// Scoped status setter (show / season / episode). UPSERT-only — status values
// aren't binary like episode-watched (tapping a different pill switches; no
// toggle-off in v1). Episode-WATCHED toggling keeps its own delete-on-unwatch
// hook (useToggleEpisodeWatched); this is the set-a-status path ScopeActions
// uses for show + season scope.
const inFlight = new Set<string>();
const keyOf = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

export function useSetWatchStatus(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryKey = ['show', tmdbShowId] as const;

  // Explicit === (incl. nulls) so a whole-show row matches whole-show scope —
  // SQL NULL≠NULL would miss it; JS === null does not. (Mirrors useRate.)
  const isScope = (r: WatchStatusRow, s: number | null, e: number | null) =>
    r.season_number === s && r.episode_number === e;

  const mutation = useMutation({
    mutationFn: async (args: Args) => {
      if (!user) throw new Error('useSetWatchStatus: no authenticated user');
      const { error } = await supabase.from('watch_status').upsert(
        {
          user_id: user.id,
          tmdb_show_id: args.tmdb_show_id,
          season_number: args.season_number,
          episode_number: args.episode_number,
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

      const match = (r: WatchStatusRow) => isScope(r, args.season_number, args.episode_number);
      const existing = prev.mySocial.watch_statuses.find(match);
      const nextStatuses = existing
        ? prev.mySocial.watch_statuses.map((r) =>
            match(r) ? { ...r, status: args.status, updated_at: new Date().toISOString() } : r,
          )
        : [
            ...prev.mySocial.watch_statuses,
            {
              id: `optimistic-${Date.now()}`,
              user_id: user!.id,
              tmdb_show_id: args.tmdb_show_id,
              season_number: args.season_number,
              episode_number: args.episode_number,
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

  // scope defaults to the whole show — existing pill callers call setStatus(status)
  // and behave identically. Route ALL status writes through here (don't inline a
  // second scoped upsert anywhere). Same shape as useRate's rate(score, scope?).
  const setStatus = async (status: WatchStatus, scope: Scope = {}) => {
    const season = scope.season_number ?? null;
    const episode = scope.episode_number ?? null;
    const k = keyOf(tmdbShowId, season, episode);
    if (inFlight.has(k)) return;
    inFlight.add(k);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      await mutation.mutateAsync({
        tmdb_show_id: tmdbShowId,
        season_number: season,
        episode_number: episode,
        status,
      });
    } catch {
      // onError already logged + restored.
    } finally {
      inFlight.delete(k);
    }
  };

  return { setStatus, isPending: mutation.isPending };
}
