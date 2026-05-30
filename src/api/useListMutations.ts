import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';

type CreateArgs = { title: string; description: string | null; showIds: number[] };

/** Create a list + its items (position = index). Returns the new id (or null if login dismissed). */
export function useCreateList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async ({ title, description, showIds }: CreateArgs) => {
      if (!user) throw new Error('useCreateList: no authenticated user');
      const { data, error } = await supabase
        .from('lists')
        .insert({ user_id: user.id, title, description })
        .select('id')
        .single();
      if (error) throw error;
      const listId = (data as { id: string }).id;
      if (showIds.length > 0) {
        const rows = showIds.map((sid, i) => ({ list_id: listId, tmdb_show_id: sid, position: i }));
        const { error: e2 } = await supabase.from('list_items').insert(rows);
        if (e2) throw e2;
      }
      return listId;
    },
    onSuccess: () => {
      if (user) qc.invalidateQueries({ queryKey: ['lists', user.id] });
    },
  });

  const create = async (args: CreateArgs): Promise<string | null> => {
    const allowed = await requireAuth();
    if (!allowed) return null;
    return mutation.mutateAsync(args);
  };

  return { create, isPending: mutation.isPending };
}

/** Delete a list (cascades its items). */
export function useDeleteList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from('lists').delete().eq('id', listId);
      if (error) throw error;
    },
    onSuccess: (_data, listId) => {
      if (user) qc.invalidateQueries({ queryKey: ['lists', user.id] });
      qc.removeQueries({ queryKey: ['list', listId] });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}

/**
 * Add/remove a show in a list (for AddToListSheet). The optimistic check lives in
 * the sheet (it owns the membership UI); these just write + invalidate the list
 * and the owner's lists (counts/previews). RLS scopes writes to the list owner.
 */
export function useListItemMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const invalidate = (listId: string) => {
    qc.invalidateQueries({ queryKey: ['list', listId] });
    if (user) qc.invalidateQueries({ queryKey: ['lists', user.id] });
  };

  const add = async (listId: string, tmdbShowId: number) => {
    // Append at the end: next position = current max + 1 (0 if empty).
    const { data: last } = await supabase
      .from('list_items')
      .select('position')
      .eq('list_id', listId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = ((last as { position: number } | null)?.position ?? -1) + 1;
    const { error } = await supabase
      .from('list_items')
      .insert({ list_id: listId, tmdb_show_id: tmdbShowId, position });
    if (error) throw error;
    invalidate(listId);
  };

  const remove = async (listId: string, tmdbShowId: number) => {
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('tmdb_show_id', tmdbShowId);
    if (error) throw error;
    invalidate(listId);
  };

  return { add, remove };
}
