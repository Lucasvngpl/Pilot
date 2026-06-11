// useBulkMarkWatched — mark many shows watched at once (clear a backlog), in ONE
// round-trip via the bulk_mark_watched RPC. The RPC is non-destructive: on conflict
// it updates STATUS ONLY, so a show already logged with a real date/review keeps its
// from_backlog flag + watched_at (its Diary entry is never touched). New rows land as
// from_backlog=true, watched_at=NULL (unknown day — excluded from the Diary + time stats).
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRequireAuth } from '@/lib/requireAuth';

export function useBulkMarkWatched() {
  const qc = useQueryClient();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.rpc('bulk_mark_watched', { ids });
      if (error) throw error;
    },
    // A status write → the Profile aggregation queries useSetWatchStatus also feeds.
    // NOT ['diary']: backlog rows are excluded there and existing diary rows are
    // never mutated, so the diary needs no refetch.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['watched'] });
      qc.invalidateQueries({ queryKey: ['watching'] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });

  // Returns true if it ran, false if login was dismissed.
  const markWatched = async (ids: number[]): Promise<boolean> => {
    const allowed = await requireAuth();
    if (!allowed) return false;
    await mutation.mutateAsync(ids);
    return true;
  };

  return { markWatched, isPending: mutation.isPending };
}
