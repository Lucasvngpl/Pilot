// blocks — the client half of the App Store 1.2 "Block" requirement (PIL-24).
//
// Blocking is GLOBAL: once you block a user, their reviews, lists, AND comments
// vanish for you everywhere, you can't interact, and the follow edges between you
// are torn down both directions. The server enforces most of this:
//   - `block_user(blocked_user)` RPC (migration 0016) inserts the block row AND
//     deletes both follow edges atomically (SECURITY DEFINER, so it can delete the
//     "they follow me" row that RLS won't let the client touch).
//   - the read Edge Functions (get-reviews, get-comments) drop blocked authors
//     server-side.
// The CLIENT half is this module: it reads "who have I blocked" (a Set) so the
// direct-RLS read paths (activity feed, lists, people search, …) can filter too,
// plus the block/unblock mutations and the Settings › Blocked users list.
//
// Why a Set fetched once and shared: the `blocks` RLS SELECT policy is
// `blocker_id = auth.uid()`, so a normal client read of `blocks` already returns
// ONLY the rows I created — exactly "the people I've blocked". Anonymous users get
// an empty set (no rows, no filtering needed — they can't block anyone).
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { BlockedUser } from '@/types';

// Plain async read of "ids I've blocked". Used both by the `useBlockedIds` hook
// (for components/screens) AND directly inside other hooks' queryFns (the activity
// feed, list reads) so each query re-derives its filter when invalidated. Fails
// OPEN (empty set) on error: a transient blocks-read failure degrades to "show
// everything" for that one render rather than blanking the whole screen.
export async function fetchBlockedIds(myId: string | undefined): Promise<Set<string>> {
  if (!myId) return new Set();
  // `.eq('blocker_id', myId)` is redundant with RLS but explicit per the CLAUDE.md
  // "always filter reads by user_id" rule (public-SELECT tables don't scope reads).
  const { data, error } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', myId);
  if (error) {
    console.error('[blocks] fetchBlockedIds failed (failing open):', error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r as { blocked_id: string }).blocked_id));
}

/**
 * The set of user ids the signed-in user has blocked. Empty set when anonymous.
 * Read once, shared across every client read path that needs to hide blocked
 * authors (people search, list filters, the user-profile gate).
 */
export function useBlockedIds() {
  const { user } = useAuth();
  const myId = user?.id;
  return useQuery<Set<string>>({
    queryKey: ['blockedIds', myId],
    enabled: !!myId,
    queryFn: () => fetchBlockedIds(myId),
  });
}

/** Convenience: is THIS user blocked by me? Returns false while loading / anon. */
export function useIsBlocked(userId: string | undefined): boolean {
  const { data } = useBlockedIds();
  return !!userId && !!data?.has(userId);
}

// Blocking changes what's visible across MANY cached queries (every content read,
// plus follow state + follower/following counts since the edges are dropped). Mark
// them all stale so they refetch — invalidateQueries matches by key prefix, so
// `['reviews']` covers every `['reviews', showId]`.
function invalidateAfterBlockChange(qc: QueryClient) {
  const keys = [
    'blockedIds', 'blockedUsers',
    'reviews', 'reviewDetail', 'myReviews', // review reads (EF + direct)
    'comments',                              // comment threads
    'showLists', 'list', 'lists', 'listDrafts', // list reads
    'searchPeople',                          // people search results
    'activity',                              // friends / you / incoming feeds
    'showViewers',                           // who-watched avatars on a show
    'isFollowing', 'profile', 'followList',  // follow edges + counts torn down
  ];
  for (const key of keys) qc.invalidateQueries({ queryKey: [key] });
}

// Dedupe rapid taps so a double-tap can't fire two RPCs.
const inFlight = new Set<string>();

/**
 * Block a user via the `block_user` RPC (insert block + drop both follow edges).
 * Gated behind the per-action login gate. Returns true on success so the caller
 * can react (e.g. navigate away from the now-blocked user's profile).
 */
export function useBlockUser() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async (blockedId: string) => {
      // Session can drop between the gate resolving and the write — fail loud.
      if (!user) throw new Error('useBlockUser: no authenticated user');
      const { error } = await supabase.rpc('block_user', { blocked_user: blockedId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAfterBlockChange(qc),
  });

  const block = async (userId: string | undefined): Promise<boolean> => {
    if (!userId) return false;
    if (inFlight.has(userId)) return false;
    inFlight.add(userId);
    try {
      const allowed = await requireAuth();
      if (!allowed) return false;
      await mutation.mutateAsync(userId);
      return true;
    } catch (e) {
      console.error('[useBlockUser] failed:', e);
      return false;
    } finally {
      inFlight.delete(userId);
    }
  };

  return { block, isPending: mutation.isPending };
}

/**
 * Unblock = delete your own block row (RLS `blocks_delete_own` allows this from the
 * client — no RPC needed). We deliberately do NOT re-create the removed follow
 * edges; the user must follow again, matching how every major app handles it.
 */
export function useUnblockUser() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!user) throw new Error('useUnblockUser: no authenticated user');
      const { error } = await supabase
        .from('blocks')
        .delete()
        .eq('blocker_id', user.id)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => invalidateAfterBlockChange(qc),
  });

  const unblock = async (userId: string): Promise<boolean> => {
    try {
      await mutation.mutateAsync(userId);
      return true;
    } catch (e) {
      console.error('[useUnblockUser] failed:', e);
      return false;
    }
  };

  return { unblock, isPending: mutation.isPending };
}

/**
 * The signed-in user's blocked list, enriched with each blocked user's profile —
 * powers Settings › Blocked users (with an Unblock action per row).
 *
 * The embed names the FK constraint (`profiles!blocks_blocked_id_fkey`) because
 * `blocks` has TWO foreign keys into profiles (blocker_id + blocked_id); without
 * naming it, PostgREST can't tell which side to join and throws PGRST201.
 */
export function useBlockedUsers() {
  const { user } = useAuth();
  const myId = user?.id;
  return useQuery<BlockedUser[]>({
    queryKey: ['blockedUsers', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocks')
        .select('blocked_id, created_at, profiles!blocks_blocked_id_fkey(username, display_name, avatar_url)')
        .eq('blocker_id', myId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        blocked_id: string;
        created_at: string;
        profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
      }[];
      return rows.map((r) => ({
        id: r.blocked_id,
        username: r.profiles?.username ?? 'unknown',
        display_name: r.profiles?.display_name ?? null,
        avatar_url: r.profiles?.avatar_url ?? null,
        blocked_at: r.created_at,
      }));
    },
  });
}
