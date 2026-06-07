// useLikes — like state (count + likedByMe + capped liker avatars) and an
// optimistic toggle, for the two likeable targets: reviews and lists.
//
// Likes are Pilot's OWN social data (not catalog), so this goes direct to the
// RLS-protected tables — no Edge Function (the TMDb-key rule doesn't apply).
//
// review_likes ships in 0001; list_likes ships in 0010 (apply that migration in
// the SQL editor before list-likes work). Both have identical shape — one row per
// (target, user), composite PK enforcing at-most-one-like — so a single internal
// helper drives both. The mutation mirrors the canonical pattern (useFollow /
// useRate): module-scope in-flight Set, requireAuth gate, optimistic onMutate +
// snapshot, onError rollback, onSettled refetch.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import { useProfile } from '@/api/useProfile';
import type { LikeState, ViewerAvatar, MyLikeEntry } from '@/types';

const LIKER_CAP = 5; // how many liker avatars the cluster shows; the rest are just counted

// The two like tables differ only in name + the FK column that points at the
// target. Describe each once and parameterize the shared helper.
type LikeKind = 'review' | 'list';
const TABLE: Record<LikeKind, { table: 'review_likes' | 'list_likes'; fk: 'review_id' | 'list_id'; queryKey: string }> = {
  review: { table: 'review_likes', fk: 'review_id', queryKey: 'reviewLikes' },
  list: { table: 'list_likes', fk: 'list_id', queryKey: 'listLikes' },
};

// One LOGICAL read of a target's likes = two cheap parallel queries against ONE
// cache entry (the same many-awaits-in-one-queryFn shape useReviewDetail uses):
//   (a) the capped likers (≤5) WITH the exact total count — `count: 'exact'` plus
//       `.limit(5)` returns the full total in the header while data has ≤5 rows,
//       so we never pull the whole liker list just to show "12 likes".
//   (b) "did I like this" — a head-only count of MY row. Needed separately because
//       my like might not be in the first 5 likers, so it can't be inferred from
//       the capped set. Skipped entirely when signed out (no row can exist).
async function fetchLikes(kind: LikeKind, targetId: string, myId: string | undefined): Promise<LikeState> {
  const { table, fk } = TABLE[kind];

  const [likersRes, mineRes] = await Promise.all([
    supabase
      .from(table)
      .select('user_id, profiles(username, avatar_url)', { count: 'exact' })
      .eq(fk, targetId)
      .order('created_at', { ascending: false })
      .limit(LIKER_CAP),
    myId
      ? supabase.from(table).select('user_id', { count: 'exact', head: true }).eq(fk, targetId).eq('user_id', myId)
      : Promise.resolve(null),
  ]);
  if (likersRes.error) throw likersRes.error;

  // supabase-js can't infer the embedded `profiles` shape from the select string,
  // so cast through unknown (same as useReviewDetail). user_id doubles as the
  // ViewerAvatar id — no need to also select profiles.id.
  const rows = (likersRes.data ?? []) as unknown as {
    user_id: string;
    profiles: { username: string; avatar_url: string | null } | null;
  }[];
  const likers: ViewerAvatar[] = rows.map((r) => ({
    id: r.user_id,
    username: r.profiles?.username ?? '',
    avatar_url: r.profiles?.avatar_url ?? null,
  }));

  return {
    count: likersRes.count ?? 0,
    likedByMe: (mineRes?.count ?? 0) > 0,
    likers,
  };
}

// Shared read hook. `initialCount` seeds the count we ALREADY have from the
// content query (get-reviews / useMyReviews carry it) so a row never flashes
// "0 likes" → real count. It's `placeholderData`, NOT `initialData`: placeholder
// shows instantly but the query STILL fetches on mount, so likedByMe + avatars
// fill in (initialData would mark the query fresh and skip the fetch).
function useLikes(kind: LikeKind, targetId: string | undefined, initialCount?: number) {
  const { user } = useAuth();
  return useQuery<LikeState>({
    queryKey: [TABLE[kind].queryKey, targetId],
    enabled: !!targetId,
    placeholderData:
      initialCount != null ? { count: initialCount, likedByMe: false, likers: [] } : undefined,
    queryFn: () => fetchLikes(kind, targetId!, user?.id),
  });
}

export function useReviewLikes(reviewId: string | undefined, opts?: { initialCount?: number }) {
  return useLikes('review', reviewId, opts?.initialCount);
}
export function useListLikes(listId: string | undefined, opts?: { initialCount?: number }) {
  return useLikes('list', listId, opts?.initialCount);
}

// Per-kind dedupe sets — a fast double-tap must not fire two inserts (the
// composite PK would 409). Keyed by target id; review and list namespaces are
// separate so a review and list sharing an id (they won't, but cheaply safe)
// don't block each other.
const inFlight: Record<LikeKind, Set<string>> = { review: new Set(), list: new Set() };

// Shared toggle hook. Decides insert-vs-delete from the FRESH cache value at tap
// time (not a stale closure), flips it optimistically, rolls back on error.
function useToggleLike(kind: LikeKind, targetId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  // My own profile, for the avatar shown in the cluster the instant I like. If it
  // hasn't loaded the cluster just shows a gray placeholder for my slot — the real
  // avatar lands on the onSettled refetch.
  const { data: myProfile } = useProfile(user?.id);
  const { table, fk, queryKey } = TABLE[kind];
  const key = [queryKey, targetId] as const;

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      // The session can drop between the gate resolving and the write — fail loud.
      if (!user) throw new Error('useToggleLike: no authenticated user');
      if (!targetId) throw new Error('useToggleLike: no targetId');
      if (next) {
        const { error } = await supabase.from(table).insert({ [fk]: targetId, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table).delete().eq(fk, targetId).eq('user_id', user.id);
        if (error) throw error;
      }
    },

    onMutate: async (next: boolean) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LikeState>(key);

      // Also reflect in the "My Likes" record if it's cached: UN-liking must drop
      // the row instantly (the user is looking at /profile/likes — it shouldn't
      // linger until a refetch). The like direction is reconciled by the onSettled
      // invalidate below (you can't be looking at a not-yet-liked thing on that page).
      const myLikesKey = user ? (['myLikes', user.id] as const) : null;
      let prevMyLikes: MyLikeEntry[] | undefined;
      if (myLikesKey && !next && targetId) {
        await qc.cancelQueries({ queryKey: myLikesKey });
        prevMyLikes = qc.getQueryData<MyLikeEntry[]>(myLikesKey);
        if (prevMyLikes) {
          qc.setQueryData<MyLikeEntry[]>(
            myLikesKey,
            prevMyLikes.filter((e) =>
              kind === 'review'
                ? !(e.kind === 'review' && e.review.reviewId === targetId)
                : !(e.kind === 'list' && e.list.id === targetId),
            ),
          );
        }
      }
      // Base off the current cache (or a zero state if nothing's loaded yet — e.g.
      // a tap during the very first fetch).
      const base: LikeState = prev ?? { count: 0, likedByMe: false, likers: [] };
      const me: ViewerAvatar = {
        id: user!.id,
        username: myProfile?.profile?.username ?? '',
        avatar_url: myProfile?.profile?.avatar_url ?? null,
      };
      // Drop any stale copy of me first, then prepend on like (newest-first matches
      // the fetch order) — keeps the cluster ≤ cap and idempotent.
      const without = base.likers.filter((l) => l.id !== me.id);
      const optimistic: LikeState = {
        count: Math.max(0, base.count + (next ? 1 : -1)),
        likedByMe: next,
        likers: next ? [me, ...without].slice(0, LIKER_CAP) : without,
      };
      qc.setQueryData<LikeState>(key, optimistic);
      return { prev, prevMyLikes };
    },

    onError: (err, _next, ctx) => {
      console.error('[useToggleLike] write failed:', err);
      // Restore the exact prior state (heart, count, AND cluster). undefined prev
      // (tapped before first load) clears back to the placeholder/refetch path.
      qc.setQueryData<LikeState | undefined>(key, ctx?.prev);
      // Roll back the My Likes removal too, if we did one.
      if (user && ctx?.prevMyLikes) qc.setQueryData(['myLikes', user.id], ctx.prevMyLikes);
    },

    // Reconcile with server truth — refetch ignores staleTime, so the count +
    // likers settle to reality even after rapid toggles. Also mark the My Likes
    // record stale so it reflects the change (adds a row on re-like, drops on unlike).
    onSettled: () => {
      qc.refetchQueries({ queryKey: key });
      if (user) qc.invalidateQueries({ queryKey: ['myLikes', user.id] });
    },
  });

  const toggle = async () => {
    if (!targetId) return;
    if (inFlight[kind].has(targetId)) return; // dedupe fast double-taps
    inFlight[kind].add(targetId);
    try {
      // Logged out → open the LoginSheet and wait; bail (no fake like) if dismissed.
      const allowed = await requireAuth();
      if (!allowed) return;
      const current = qc.getQueryData<LikeState>(key)?.likedByMe ?? false;
      await mutation.mutateAsync(!current);
    } catch {
      // onError already logged + rolled back.
    } finally {
      inFlight[kind].delete(targetId);
    }
  };

  return { toggle, isPending: mutation.isPending };
}

export function useToggleReviewLike(reviewId: string | undefined) {
  return useToggleLike('review', reviewId);
}
export function useToggleListLike(listId: string | undefined) {
  return useToggleLike('list', listId);
}
