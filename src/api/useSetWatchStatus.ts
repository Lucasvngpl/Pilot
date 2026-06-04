import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import { todayLocal } from '@/types';
import type { GetShowResponse, WatchStatus, WatchStatusRow } from '@/types';

// Scope defaults to whole show (both null). Pass season/episode for narrower scopes.
type Scope = { season_number?: number | null; episode_number?: number | null };
type Args = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  status: WatchStatus; // ignored when `clear` is set (the row is deleted, not written)
  // Delete the status row at this scope instead of upserting. Powers a true
  // toggle-OFF (the Seasons-tab season eye: tap once → 'watched', tap again →
  // cleared) without a second hook — same delete-on-unwatch shape as the episode
  // toggle, but at show/season scope.
  clear?: boolean;
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

      if (args.clear) {
        // Composite-key delete (never by row id — could be an optimistic
        // placeholder). Null scope fields need `.is(null)`, non-null need `.eq`
        // — PostgREST treats `.eq(col, null)` as no match (NULL ≠ NULL). Same
        // per-field split as AddToListSheet's membership query.
        let q = supabase
          .from('watch_status')
          .delete()
          .eq('user_id', user.id)
          .eq('tmdb_show_id', args.tmdb_show_id);
        q = args.season_number === null ? q.is('season_number', null) : q.eq('season_number', args.season_number);
        q = args.episode_number === null ? q.is('episode_number', null) : q.eq('episode_number', args.episode_number);
        const { error } = await q;
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('watch_status').upsert(
        {
          user_id: user.id,
          tmdb_show_id: args.tmdb_show_id,
          season_number: args.season_number,
          episode_number: args.episode_number,
          status: args.status,
          // Stamp today's date ONLY when marking watched — so a watchlist→watched
          // (or watching→watched) flip dates the watch to NOW, not to whenever the
          // row was first inserted. For watching/watchlist we omit it (the column
          // is never read for those statuses; omitting preserves any prior date).
          ...(args.status === 'watched' ? { watched_at: todayLocal() } : {}),
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
      // clear → drop the scope's row; else upsert (patch existing or append).
      const nextStatuses = args.clear
        ? prev.mySocial.watch_statuses.filter((r) => !match(r))
        : existing
        ? prev.mySocial.watch_statuses.map((r) =>
            match(r)
              ? {
                  ...r,
                  status: args.status,
                  updated_at: new Date().toISOString(),
                  // Mirror the write: marking watched dates it today; other statuses
                  // keep the row's existing watched_at.
                  watched_at: args.status === 'watched' ? todayLocal() : r.watched_at,
                }
              : r,
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
              watched_at: todayLocal(),
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
      // The Diary lists every show/season-scope `watched` event. Switching this
      // scope TO `watched` adds an entry; switching it AWAY (to watching/watchlist)
      // must drop it. Prefix matches ['diary', userId].
      qc.invalidateQueries({ queryKey: ['diary'] });
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

  // Delete the status row at this scope (toggle-OFF). Shares the in-flight guard
  // + optimistic path with setStatus. `status` is a placeholder — clear deletes.
  const clearStatus = async (scope: Scope = {}) => {
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
        status: 'watched',
        clear: true,
      });
    } catch {
      // onError already logged + restored.
    } finally {
      inFlight.delete(k);
    }
  };

  return { setStatus, clearStatus, isPending: mutation.isPending };
}
