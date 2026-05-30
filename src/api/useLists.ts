import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { ListSummary, ListDetail } from '@/types';

type ListRow = { id: string; title: string; description: string | null };
type ItemRow = { list_id: string; tmdb_show_id: number };

/**
 * A user's lists (any user) for the profile Lists tab — newest first, each with
 * an item count + up to 4 poster previews. Items within a list are ordered
 * `position` then `added_at` so the preview is STABLE across fetches.
 */
export function useMyLists(userId: string | undefined) {
  return useQuery<ListSummary[]>({
    queryKey: ['lists', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from('lists')
        .select('id, title, description, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (lists ?? []) as ListRow[];
      if (rows.length === 0) return [];

      const ids = rows.map((l) => l.id);
      const { data: items, error: iErr } = await supabase
        .from('list_items')
        .select('list_id, tmdb_show_id, position, added_at')
        .in('list_id', ids)
        .order('position', { ascending: true })
        .order('added_at', { ascending: true });
      if (iErr) throw iErr;

      const byList = new Map<string, number[]>(); // list_id → ordered show ids
      for (const it of (items ?? []) as ItemRow[]) {
        const arr = byList.get(it.list_id) ?? [];
        arr.push(it.tmdb_show_id);
        byList.set(it.list_id, arr);
      }

      const previewIds = [...new Set(rows.flatMap((l) => (byList.get(l.id) ?? []).slice(0, 4)))];
      const cards = await fetchShowCards(previewIds);

      return rows.map((l) => {
        const showIds = byList.get(l.id) ?? [];
        return {
          id: l.id,
          title: l.title,
          description: l.description,
          itemCount: showIds.length,
          posters: showIds.slice(0, 4).map((sid) => cards.get(sid)?.poster_path ?? null),
        };
      });
    },
  });
}

/**
 * One list in detail: its shows (stable `position`, `added_at` order) + the
 * owner's handle. Public read — works for anyone's list. Returns null if missing.
 */
export function useList(listId: string | undefined) {
  return useQuery<ListDetail | null>({
    queryKey: ['list', listId],
    enabled: !!listId,
    queryFn: async () => {
      const { data: list, error } = await supabase
        .from('lists')
        .select('id, user_id, title, description, is_ranked')
        .eq('id', listId!)
        .maybeSingle();
      if (error) throw error;
      if (!list) return null;
      const row = list as {
        id: string; user_id: string; title: string; description: string | null; is_ranked: boolean;
      };

      const [itemsRes, ownerRes] = await Promise.all([
        supabase
          .from('list_items')
          .select('tmdb_show_id, position, added_at')
          .eq('list_id', listId!)
          .order('position', { ascending: true })
          .order('added_at', { ascending: true }),
        supabase.from('profiles').select('username').eq('id', row.user_id).maybeSingle(),
      ]);
      if (itemsRes.error) throw itemsRes.error;

      const showIds = (itemsRes.data ?? []).map((i) => (i as { tmdb_show_id: number }).tmdb_show_id);
      const cards = await fetchShowCards(showIds);
      const owner = ownerRes.data as { username: string } | null;

      return {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description,
        is_ranked: row.is_ranked,
        ownerUsername: owner?.username ?? null,
        items: showIds.map(
          (sid) => cards.get(sid) ?? { tmdb_show_id: sid, name: 'Untitled', poster_path: null },
        ),
      };
    },
  });
}
