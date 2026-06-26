// useComments — read + post + delete for flat comments on a review or a list
// (PIL-24). The READ goes through the get-comments Edge Function (so block
// filtering happens server-side, defense in depth); the WRITES go direct to the
// RLS-protected `comments` table (Pilot's own social data — the catalog-via-EF
// rule is about the TMDb key, untouched here). The mutations follow the canonical
// write pattern (CLAUDE.md): requireAuth gate, in-flight Set, optimistic update
// snapshotting only this thread, onError rollback, refetch + Incoming invalidate.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import { useProfile } from '@/api/useProfile';
import type { CommentTargetType, CommentWithMeta, GetCommentsResponse } from '@/types';

// One cache entry per thread: ['comments', target_type, target_id]. The value is
// the comment array (oldest-first, the order a thread reads top-to-bottom).
const commentsKey = (t: CommentTargetType, id: string | undefined) => ['comments', t, id] as const;

/** All comments on one target (oldest-first), enriched server-side. Public read. */
export function useComments(targetType: CommentTargetType, targetId: string | undefined) {
  return useQuery<CommentWithMeta[]>({
    queryKey: commentsKey(targetType, targetId),
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<GetCommentsResponse>('get-comments', {
        body: { target_type: targetType, target_id: targetId },
      });
      if (error) throw error;
      if (!data) throw new Error('get-comments returned no data');
      return data.comments;
    },
  });
}

// Per-target dedupe so a double-tap on Post can't double-insert.
const postInFlight = new Set<string>();

/** Post a comment on a target. Gated behind the per-action login gate. */
export function usePostComment(targetType: CommentTargetType, targetId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  // My profile for the optimistic row's name/avatar (lands instantly; the real
  // server row replaces it on the onSettled refetch).
  const { data: myProfile } = useProfile(user?.id);
  const key = commentsKey(targetType, targetId);

  const mutation = useMutation({
    mutationFn: async (body: string) => {
      // Session can drop between the gate and the write — fail loud.
      if (!user) throw new Error('usePostComment: no authenticated user');
      const { error } = await supabase
        .from('comments')
        .insert({ user_id: user.id, target_type: targetType, target_id: targetId, body });
      if (error) throw error;
    },

    onMutate: async (body: string) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentWithMeta[]>(key);
      const optimistic: CommentWithMeta = {
        id: `temp-${Date.now()}`, // replaced by the real id on refetch
        user_id: user!.id,
        body,
        created_at: new Date().toISOString(),
        username: myProfile?.profile?.username ?? '',
        display_name: myProfile?.profile?.display_name ?? null,
        avatar_url: myProfile?.profile?.avatar_url ?? null,
        like_count: 0,
        liked_by_me: false,
      };
      // Oldest-first thread → append at the END.
      qc.setQueryData<CommentWithMeta[]>(key, [...(prev ?? []), optimistic]);
      return { prev };
    },

    onError: (err, _body, ctx) => {
      console.error('[usePostComment] failed:', err);
      qc.setQueryData<CommentWithMeta[] | undefined>(key, ctx?.prev);
    },

    onSettled: () => {
      // Mounted thread → refetch (reconcile the temp row with the server row).
      qc.refetchQueries({ queryKey: key });
      // A new comment on someone's content is an Incoming-lane event — mark it
      // stale so their notifications refresh next open.
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });

  const post = async (body: string): Promise<boolean> => {
    const trimmed = body.trim();
    if (!trimmed) return false; // DB rejects blank (length(btrim(body)) > 0); guard early
    const dkey = `${targetType}:${targetId}`;
    if (postInFlight.has(dkey)) return false;
    postInFlight.add(dkey);
    try {
      const allowed = await requireAuth();
      if (!allowed) return false;
      await mutation.mutateAsync(trimmed);
      return true;
    } catch {
      return false; // onError already logged + rolled back
    } finally {
      postInFlight.delete(dkey);
    }
  };

  return { post, isPending: mutation.isPending };
}

/** Delete YOUR OWN comment (RLS allows delete only where user_id = you). */
export function useDeleteComment(targetType: CommentTargetType, targetId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = commentsKey(targetType, targetId);

  const mutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!user) throw new Error('useDeleteComment: no authenticated user');
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id); // RLS enforces this too, but be explicit
      if (error) throw error;
    },

    onMutate: async (commentId: string) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<CommentWithMeta[]>(key);
      if (prev) qc.setQueryData<CommentWithMeta[]>(key, prev.filter((c) => c.id !== commentId));
      return { prev };
    },

    onError: (err, _id, ctx) => {
      console.error('[useDeleteComment] failed:', err);
      qc.setQueryData<CommentWithMeta[] | undefined>(key, ctx?.prev);
    },

    onSettled: () => {
      qc.refetchQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['activity'] });
    },
  });

  const remove = async (commentId: string): Promise<boolean> => {
    try {
      await mutation.mutateAsync(commentId);
      return true;
    } catch {
      return false;
    }
  };

  return { remove, isPending: mutation.isPending };
}

// Per-comment dedupe so a fast double-tap can't fire two inserts (the composite
// PK would 409).
const likeInFlight = new Set<string>();

/**
 * Toggle YOUR like on a comment. Like state lives ON each comment row
 * (`like_count` / `liked_by_me`, aggregated by get-comments), so the optimistic
 * update edits that comment inside the SAME `['comments', target]` cache the
 * thread already reads — no separate per-comment query (avoids N+1). Writes go
 * direct to the RLS-protected `comment_likes` table; gated behind the per-action
 * login gate like every other like (useLikes).
 */
export function useToggleCommentLike(targetType: CommentTargetType, targetId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const key = commentsKey(targetType, targetId);

  // Apply liked/unliked to one comment in the cached thread; returns the prior
  // array for rollback.
  const patch = (commentId: string, liked: boolean) => {
    const prev = qc.getQueryData<CommentWithMeta[]>(key);
    if (prev) {
      qc.setQueryData<CommentWithMeta[]>(
        key,
        prev.map((c) =>
          c.id === commentId
            ? { ...c, liked_by_me: liked, like_count: Math.max(0, c.like_count + (liked ? 1 : -1)) }
            : c,
        ),
      );
    }
    return prev;
  };

  const mutation = useMutation({
    mutationFn: async ({ commentId, next }: { commentId: string; next: boolean }) => {
      if (!user) throw new Error('useToggleCommentLike: no authenticated user');
      if (next) {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },

    onMutate: async ({ commentId, next }: { commentId: string; next: boolean }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = patch(commentId, next);
      return { prev };
    },

    onError: (err, _vars, ctx) => {
      console.error('[useToggleCommentLike] failed:', err);
      qc.setQueryData<CommentWithMeta[] | undefined>(key, ctx?.prev);
    },

    // Reconcile with server truth (count settles even after rapid toggles).
    onSettled: () => {
      qc.refetchQueries({ queryKey: key });
    },
  });

  const toggleLike = async (commentId: string) => {
    // Optimistic rows (temp-…) aren't real yet — nothing to like.
    if (commentId.startsWith('temp-')) return;
    if (likeInFlight.has(commentId)) return;
    likeInFlight.add(commentId);
    try {
      // Logged out → raise the LoginSheet; bail (no fake like) if dismissed.
      const allowed = await requireAuth();
      if (!allowed) return;
      // Decide insert-vs-delete from the FRESH cache value at tap time.
      const cur = qc.getQueryData<CommentWithMeta[]>(key)?.find((c) => c.id === commentId);
      await mutation.mutateAsync({ commentId, next: !(cur?.liked_by_me ?? false) });
    } catch {
      // onError already logged + rolled back.
    } finally {
      likeInFlight.delete(commentId);
    }
  };

  return { toggleLike };
}
