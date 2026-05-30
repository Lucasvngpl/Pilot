import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { ProfileData } from '@/api/useProfile';

/**
 * Follow is asymmetric: one `follows` row {follower_id: me, followee_id}.
 *
 * One hook exposes the follow-state + an optimistic toggle (merging the spec's
 * useFollow/useUnfollow into a single path). Mirrors the canonical mutation
 * pattern (useRate / useSetWatchStatus): module-scope in-flight Set, requireAuth
 * gate, optimistic onMutate + snapshot, onError rollback, onSettled refetch.
 */

// Dedupe rapid toggles per followee — a fast double-tap must not fire two
// inserts (the composite PK would 409; this guard avoids the error flash).
const inFlight = new Set<string>();

export function useFollow(followeeId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const myId = user?.id;

  const stateKey = ['isFollowing', myId, followeeId] as const;
  const profileKey = (id: string) => ['profile', id] as const;

  // Do I follow this user? Public-read follows, filtered to my edge. Only runs
  // when authed, a real followee, and not myself.
  const { data: isFollowing = false } = useQuery({
    queryKey: stateKey,
    enabled: !!myId && !!followeeId && myId !== followeeId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', myId!)
        .eq('followee_id', followeeId!);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (!user) throw new Error('useFollow: no authenticated user');
      if (!followeeId) throw new Error('useFollow: no followeeId');
      if (next) {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: user.id, followee_id: followeeId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('followee_id', followeeId);
        if (error) throw error;
      }
    },

    onMutate: async (next: boolean) => {
      // Cancel refetches that could clobber the optimistic state.
      await qc.cancelQueries({ queryKey: stateKey });
      await qc.cancelQueries({ queryKey: profileKey(followeeId!) });
      if (myId) await qc.cancelQueries({ queryKey: profileKey(myId) });

      const prevIsFollowing = qc.getQueryData<boolean>(stateKey);
      const prevFollowee = qc.getQueryData<ProfileData>(profileKey(followeeId!));
      const prevMine = myId ? qc.getQueryData<ProfileData>(profileKey(myId)) : undefined;

      const delta = next ? 1 : -1;
      // (a) flip my follow-state for this user
      qc.setQueryData<boolean>(stateKey, next);
      // (b) the followee's FOLLOWER count (if their profile is cached)
      if (prevFollowee) {
        qc.setQueryData<ProfileData>(profileKey(followeeId!), {
          ...prevFollowee,
          followers: Math.max(0, prevFollowee.followers + delta),
        });
      }
      // (c) MY FOLLOWING count (so my own number doesn't lag until refetch)
      if (myId && prevMine) {
        qc.setQueryData<ProfileData>(profileKey(myId), {
          ...prevMine,
          following: Math.max(0, prevMine.following + delta),
        });
      }
      return { prevIsFollowing, prevFollowee, prevMine };
    },

    onError: (err, _next, ctx) => {
      console.error('[useFollow] write failed:', err);
      if (ctx?.prevIsFollowing !== undefined) qc.setQueryData(stateKey, ctx.prevIsFollowing);
      if (ctx?.prevFollowee) qc.setQueryData(profileKey(followeeId!), ctx.prevFollowee);
      if (myId && ctx?.prevMine) qc.setQueryData(profileKey(myId), ctx.prevMine);
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey: stateKey });
      if (followeeId) qc.refetchQueries({ queryKey: profileKey(followeeId) });
      if (myId) qc.refetchQueries({ queryKey: profileKey(myId) });
    },
  });

  const toggle = async () => {
    if (!followeeId || followeeId === myId) return; // never follow yourself
    if (inFlight.has(followeeId)) return; // dedupe fast double-taps
    inFlight.add(followeeId);
    try {
      const allowed = await requireAuth();
      if (!allowed) return;
      // Decide insert-vs-delete from the current (optimistic) follow-state.
      await mutation.mutateAsync(!isFollowing);
    } catch {
      // onError already logged + rolled back.
    } finally {
      inFlight.delete(followeeId);
    }
  };

  return { isFollowing, toggle, isPending: mutation.isPending };
}
