import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';

/**
 * Replace the caller's Top-4 with `showIds`, in slot order (first = position 1).
 *
 * "Replace" without an empty window: upsert each id with its new position, THEN
 * delete any previously-favorited show that's no longer in the set. (If we
 * deleted-all-then-inserted, a mid-save failure could wipe the favorites; this
 * order never leaves the row set empty.) Passing `[]` clears all favorites.
 *
 * Gating mirrors useSetWatchStatus / useCreateList: `requireAuth()` first, and
 * `if (!user) throw` inside the writer (the session can drop between the gate
 * resolving and the write running — fail loud, not on `user!.id`).
 */
export function useSetTopShows() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async (showIds: number[]) => {
      if (!user) throw new Error('useSetTopShows: no authenticated user');
      const uid = user.id;

      if (showIds.length > 0) {
        const rows = showIds.map((tmdb_show_id, i) => ({
          user_id: uid,
          tmdb_show_id,
          position: i + 1, // 1-based slot, in add-order
        }));
        const { error: upsertErr } = await supabase
          .from('profile_top_shows')
          .upsert(rows, { onConflict: 'user_id,tmdb_show_id' });
        if (upsertErr) throw upsertErr;
      }

      // Drop rows for shows the user removed — or ALL rows when clearing.
      // PostgREST `not.in` wants a parenthesised list: not('col','in','(1,2,3)').
      let del = supabase.from('profile_top_shows').delete().eq('user_id', uid);
      if (showIds.length > 0) del = del.not('tmdb_show_id', 'in', `(${showIds.join(',')})`);
      const { error: delErr } = await del;
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      if (user) qc.invalidateQueries({ queryKey: ['topShows', user.id] });
    },
  });

  // Returns true if saved, false if the user dismissed the login gate. Throws on
  // a real write error so the caller can surface it.
  const save = async (showIds: number[]): Promise<boolean> => {
    const allowed = await requireAuth();
    if (!allowed) return false;
    await mutation.mutateAsync(showIds);
    return true;
  };

  return { save, isPending: mutation.isPending };
}
