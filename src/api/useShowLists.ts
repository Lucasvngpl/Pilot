import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import type { ListSummary } from '@/types';

type ListRow = { id: string; title: string; description: string | null };
type ItemRow = { list_id: string; tmdb_show_id: number };

/**
 * Public lists that include a given show — powers Show Detail › Lists (and its
 * tab-count badge via `.length`).
 *
 * Direct RLS client query — this is Pilot's OWN social data, not TMDb, so no Edge
 * Function. Three steps: find the lists whose items include this show, keep only
 * the PUBLIC ones, then load poster previews (mirrors useMyLists in useLists.ts).
 *
 * The `.eq('is_public', true)` filter is the no-leak discipline AT THE QUERY LEVEL:
 * a private list that happens to include this show never surfaces on the public
 * show page (same idea as filtering drafts out of public review reads).
 */
export function useShowLists(tmdbShowId: number | undefined) {
  return useQuery<ListSummary[]>({
    queryKey: ['showLists', tmdbShowId],
    enabled: typeof tmdbShowId === 'number' && tmdbShowId > 0,
    queryFn: async () => {
      // 1. Which lists contain this show? (membership rows only)
      const { data: hits, error: hErr } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('tmdb_show_id', tmdbShowId!);
      if (hErr) throw hErr;
      const listIds = [...new Set((hits ?? []).map((r) => (r as { list_id: string }).list_id))];
      if (listIds.length === 0) return [];

      // 2. Of those, the PUBLIC ones only (newest first). The is_public filter is
      //    what keeps a private list off the public show page.
      const { data: lists, error: lErr } = await supabase
        .from('lists')
        .select('id, title, description, created_at')
        .in('id', listIds)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (lErr) throw lErr;
      const rows = (lists ?? []) as ListRow[];
      if (rows.length === 0) return [];

      // 3. Poster previews — every item of the public lists, ordered for a STABLE
      //    preview across refetches (position then added_at, like useMyLists).
      const publicIds = rows.map((l) => l.id);
      const { data: items, error: iErr } = await supabase
        .from('list_items')
        .select('list_id, tmdb_show_id, position, added_at')
        .in('list_id', publicIds)
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
