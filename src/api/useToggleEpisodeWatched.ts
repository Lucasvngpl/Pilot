import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import { todayLocal } from '@/types';
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
      console.error('[useToggleEpisodeWatched] write failed:', err);
      if (ctx?.prevStatuses) {
        qc.setQueryData<GetShowResponse>(queryKey, (curr) =>
          curr ? { ...curr, mySocial: { ...curr.mySocial, watch_statuses: ctx.prevStatuses! } } : curr,
        );
      }
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey });
      // Any watched episode includes the show in the Profile "Shows" grid, and the
      // currently-watching tile aggregates the latest watched episode into its
      // "S2 E5" line — so both Profile queries must refetch on next open.
      qc.invalidateQueries({ queryKey: ['watched'] });
      qc.invalidateQueries({ queryKey: ['watching'] });
      // The Diary is event-level: each episode-watched row is its own entry, so
      // toggling one ON adds an entry and toggling it OFF (delete) must remove it.
      // Prefix key matches ['diary', userId]. Without this, an un-watched episode
      // lingers in the Diary until staleTime lapses (the bug we're fixing).
      qc.invalidateQueries({ queryKey: ['diary'] });
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

// ----- Mark a whole season watched -----------------------------------------

type MarkSeasonArgs = {
  tmdb_show_id: number;
  season_number: number;
  episode_numbers: number[];
};

// Per-season in-flight guard (so a double-tap on "Mark all" doesn't double-fire).
const seasonInFlight = new Set<string>();
const seasonKeyOf = (a: MarkSeasonArgs) => `${a.tmdb_show_id}:${a.season_number}`;

// One-way "Mark all watched" for a season: a SINGLE batched upsert of every
// episode-scope row (idempotent — already-watched episodes stay watched), not N
// toggles. Same optimistic/restore/invalidate shape as the per-episode toggle.
export function useMarkSeasonWatched(tmdbShowId: number) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const queryKey = ['show', tmdbShowId] as const;

  const mutation = useMutation({
    mutationFn: async (args: MarkSeasonArgs) => {
      if (!user) throw new Error('useMarkSeasonWatched: no authenticated user');
      if (args.episode_numbers.length === 0) return;
      const rows = args.episode_numbers.map((ep) => ({
        user_id: user.id,
        tmdb_show_id: args.tmdb_show_id,
        season_number: args.season_number,
        episode_number: ep,
        status: 'watched' as const,
      }));
      const { error } = await supabase
        .from('watch_status')
        .upsert(rows, { onConflict: 'user_id,tmdb_show_id,season_number,episode_number' });
      if (error) throw error;
    },

    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<GetShowResponse>(queryKey);
      if (!prev) return { prevStatuses: null };

      // Don't duplicate episodes already marked watched for this season.
      const already = new Set(
        prev.mySocial.watch_statuses
          .filter((r) => r.season_number === args.season_number && r.episode_number != null)
          .map((r) => r.episode_number),
      );
      const additions = args.episode_numbers
        .filter((ep) => !already.has(ep))
        .map((ep) =>
          ({
            id: `optimistic-${args.season_number}-${ep}-${Date.now()}`,
            user_id: user!.id,
            tmdb_show_id: args.tmdb_show_id,
            season_number: args.season_number,
            episode_number: ep,
            status: 'watched',
            updated_at: new Date().toISOString(),
            watched_at: todayLocal(),
          }) satisfies WatchStatusRow,
        );

      qc.setQueryData<GetShowResponse>(queryKey, {
        ...prev,
        mySocial: {
          ...prev.mySocial,
          watch_statuses: [...prev.mySocial.watch_statuses, ...additions],
        },
      });
      return { prevStatuses: prev.mySocial.watch_statuses };
    },

    onError: (err, _args, ctx) => {
      console.error('[useMarkSeasonWatched] write failed:', err);
      if (ctx?.prevStatuses) {
        qc.setQueryData<GetShowResponse>(queryKey, (curr) =>
          curr ? { ...curr, mySocial: { ...curr.mySocial, watch_statuses: ctx.prevStatuses! } } : curr,
        );
      }
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['watched'] });
      qc.invalidateQueries({ queryKey: ['watching'] });
      // Each newly-watched episode is its own Diary entry — refresh it too.
      qc.invalidateQueries({ queryKey: ['diary'] });
    },
  });

  const markAll = async (args: MarkSeasonArgs) => {
    const k = seasonKeyOf(args);
    if (seasonInFlight.has(k)) return;
    seasonInFlight.add(k);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      await mutation.mutateAsync(args);
    } catch {
      // onError already logged + restored.
    } finally {
      seasonInFlight.delete(k);
    }
  };

  return { markAll, isPending: mutation.isPending };
}
