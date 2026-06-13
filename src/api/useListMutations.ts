// useListMutations — create, update, delete lists, and add/remove individual shows within a list.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';

// Each created item is a scope tuple — a list can hold shows, seasons, episodes.
type CreateItem = { tmdb_show_id: number; season_number: number | null; episode_number: number | null };
// is_draft defaults false (a normal published list). Save-draft passes true; an
// untitled draft is allowed (the DB check only requires a title once published).
type CreateArgs = { title: string; description: string | null; items: CreateItem[]; is_draft?: boolean };

// Optional scope for a list item (defaults to whole show — both null). Pass
// season/episode to add a season or episode to a list (0009's polymorphic scope).
type ItemScope = { season_number?: number | null; episode_number?: number | null };

/** Create a list + its items (position = index). Returns the new id (or null if login dismissed). */
export function useCreateList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async ({ title, description, items, is_draft }: CreateArgs) => {
      if (!user) throw new Error('useCreateList: no authenticated user');
      const { data, error } = await supabase
        .from('lists')
        .insert({ user_id: user.id, title, description, is_draft: is_draft ?? false })
        .select('id')
        .single();
      if (error) throw error;
      const listId = (data as { id: string }).id;
      if (items.length > 0) {
        const rows = items.map((it, i) => ({
          list_id: listId,
          tmdb_show_id: it.tmdb_show_id,
          season_number: it.season_number,
          episode_number: it.episode_number,
          position: i,
        }));
        const { error: e2 } = await supabase.from('list_items').insert(rows);
        if (e2) throw e2;
      }
      return listId;
    },
    onSuccess: () => {
      if (user) {
        qc.invalidateQueries({ queryKey: ['lists', user.id] });
        // Save-draft writes a draft row → Profile › Drafts (useDraftLists, keyed
        // ['listDrafts', userId]) must refresh NOW, not after its staleTime lapses.
        // Missing this is exactly why a saved draft took minutes to appear (PIL-9).
        qc.invalidateQueries({ queryKey: ['listDrafts', user.id] });
      }
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
      if (user) {
        qc.invalidateQueries({ queryKey: ['lists', user.id] });
        // Deleting a DRAFT list from Profile › Drafts must refresh that list now —
        // without this it lingered until a manual refresh (useDraftLists is keyed
        // ['listDrafts', userId]).
        qc.invalidateQueries({ queryKey: ['listDrafts', user.id] });
      }
      qc.removeQueries({ queryKey: ['list', listId] });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}

// is_draft optional: pass false to PUBLISH a draft, omit to leave the flag as-is.
type UpdateArgs = { title: string; description: string | null; is_draft?: boolean };

/** Update a list's title/description (+ optional draft flag). Items are reconciled separately via useListItemMutations. */
export function useUpdateList() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async ({ listId, title, description, is_draft }: UpdateArgs & { listId: string }) => {
      if (!user) throw new Error('useUpdateList: no authenticated user');
      const { error } = await supabase
        .from('lists')
        .update({ title, description, ...(is_draft !== undefined ? { is_draft } : {}) })
        .eq('id', listId);
      if (error) throw error;
    },
    onSuccess: (_d, { listId }) => {
      qc.invalidateQueries({ queryKey: ['list', listId] });
      if (user) {
        qc.invalidateQueries({ queryKey: ['lists', user.id] });
        // Editing a draft (or publishing it, which removes it from Drafts) must
        // refresh the drafts list immediately too (PIL-9).
        qc.invalidateQueries({ queryKey: ['listDrafts', user.id] });
      }
    },
  });

  // Returns true if saved, false if login was dismissed.
  const update = async (listId: string, args: UpdateArgs): Promise<boolean> => {
    const allowed = await requireAuth();
    if (!allowed) return false;
    await mutation.mutateAsync({ listId, ...args });
    return true;
  };

  return { update, isPending: mutation.isPending };
}

/**
 * Set (or clear) a list's custom banner — a TMDb backdrop PATH, or null to fall
 * back to the auto-composite. Owner-only by RLS (lists_update_own). Invalidates the
 * list detail + the owner's lists (the banner could feed a future preview).
 */
export function useSetListBanner() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const mutation = useMutation({
    mutationFn: async ({ listId, backdropPath }: { listId: string; backdropPath: string | null }) => {
      const { error } = await supabase
        .from('lists')
        .update({ banner_backdrop_path: backdropPath })
        .eq('id', listId);
      if (error) throw error;
    },
    onSuccess: (_d, { listId }) => {
      qc.invalidateQueries({ queryKey: ['list', listId] });
      if (user) qc.invalidateQueries({ queryKey: ['lists', user.id] });
    },
  });
  return {
    setBanner: (listId: string, backdropPath: string | null) =>
      mutation.mutateAsync({ listId, backdropPath }),
    isPending: mutation.isPending,
  };
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

  // Scope defaults to the whole show (both null) — so existing show-scope callers
  // (AddToListSheet from a show page) are unchanged. Pass season/episode to add a
  // scoped item (a season or an episode) to the list.
  const add = async (listId: string, tmdbShowId: number, scope: ItemScope = {}) => {
    const season = scope.season_number ?? null;
    const episode = scope.episode_number ?? null;
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
      .insert({ list_id: listId, tmdb_show_id: tmdbShowId, season_number: season, episode_number: episode, position });
    if (error) throw error;
    invalidate(listId);
  };

  const remove = async (listId: string, tmdbShowId: number, scope: ItemScope = {}) => {
    const season = scope.season_number ?? null;
    const episode = scope.episode_number ?? null;
    // Match the EXACT scope row — `.is(null)` vs `.eq(n)` per field, so removing
    // the whole-show item doesn't also delete its season/episode items.
    let q = supabase.from('list_items').delete().eq('list_id', listId).eq('tmdb_show_id', tmdbShowId);
    q = season === null ? q.is('season_number', null) : q.eq('season_number', season);
    q = episode === null ? q.is('episode_number', null) : q.eq('episode_number', episode);
    const { error } = await q;
    if (error) throw error;
    invalidate(listId);
  };

  // Renumber a list's items to match `orderedShowIds` (position = 0,1,2…). We
  // renumber EVERY row sequentially rather than swapping in place, so there are
  // no gaps or collisions. Safe to do per-row: list_items has NO
  // UNIQUE(list_id, position) (0001), specifically so a reorder can pass through
  // transient duplicate positions. RLS scopes the writes to the list owner.
  //
  // NOTE: keys by tmdb_show_id, so it's correct only while a list holds each show
  // ONCE (the show-scope-only case — all lists today). When the list detail
  // starts rendering + reordering scoped items (a show at multiple scopes), this
  // must renumber by the surrogate `id` (0009). Revisit with that UI in TASK 4.
  const reorder = async (listId: string, orderedShowIds: number[]) => {
    for (let i = 0; i < orderedShowIds.length; i++) {
      const { error } = await supabase
        .from('list_items')
        .update({ position: i })
        .eq('list_id', listId)
        .eq('tmdb_show_id', orderedShowIds[i]);
      if (error) throw error;
    }
    invalidate(listId);
  };

  return { add, remove, reorder };
}
