import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import { resolveScope } from '@/types';
import type { ListSummary, ListDetail } from '@/types';

type ListRow = { id: string; title: string; description: string | null };
type ItemRow = {
  list_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
};

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
        .select('list_id, tmdb_show_id, season_number, episode_number, position, added_at')
        .in('list_id', ids)
        .order('position', { ascending: true })
        .order('added_at', { ascending: true });
      if (iErr) throw iErr;

      // list_id → ordered scope tuples (a row may be a show, season, or episode).
      const byList = new Map<string, ItemRow[]>();
      for (const it of (items ?? []) as ItemRow[]) {
        const arr = byList.get(it.list_id) ?? [];
        arr.push(it);
        byList.set(it.list_id, arr);
      }

      // Cards WITH scope art so the preview posters match the list-detail banner
      // (resolveScope picks the season/episode's own poster).
      const previewIds = [...new Set(rows.flatMap((l) => (byList.get(l.id) ?? []).slice(0, 4).map((t) => t.tmdb_show_id)))];
      const cards = await fetchShowCards(previewIds, { withScopeArt: true });

      return rows.map((l) => {
        const tuples = byList.get(l.id) ?? [];
        return {
          id: l.id,
          title: l.title,
          description: l.description,
          itemCount: tuples.length,
          posters: tuples.slice(0, 4).map((t) =>
            resolveScope(
              { tmdb_show_id: t.tmdb_show_id, season_number: t.season_number, episode_number: t.episode_number },
              cards.get(t.tmdb_show_id),
            ).posterPath,
          ),
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
        .select('id, user_id, title, description, is_ranked, created_at')
        .eq('id', listId!)
        .maybeSingle();
      if (error) throw error;
      if (!list) return null;
      const row = list as {
        id: string; user_id: string; title: string; description: string | null;
        is_ranked: boolean; created_at: string;
      };

      const [itemsRes, ownerRes] = await Promise.all([
        supabase
          .from('list_items')
          .select('tmdb_show_id, season_number, episode_number, position, added_at')
          .eq('list_id', listId!)
          .order('position', { ascending: true })
          .order('added_at', { ascending: true }),
        supabase.from('profiles').select('username, avatar_url').eq('id', row.user_id).maybeSingle(),
      ]);
      if (itemsRes.error) throw itemsRes.error;

      // The list_items rows, in order — each is a scope tuple (show / season /
      // episode). Distinct show ids for the card fetch (a show can appear at more
      // than one scope now).
      const itemRows = (itemsRes.data ?? []) as {
        tmdb_show_id: number; season_number: number | null; episode_number: number | null;
      }[];
      const showIds = [...new Set(itemRows.map((i) => i.tmdb_show_id))];

      // Cards WITH scope art (season posters + episode stills/names) so a scoped
      // row renders its own art, + a light meta read for the row subtitle. Meta
      // pulls year + the primary network from the cached payload via JSON
      // operators (->>, ->) — no extra round-trip to TMDb.
      const [cards, metaRes] = await Promise.all([
        fetchShowCards(showIds, { withScopeArt: true }),
        supabase
          .from('shows_cache')
          .select('tmdb_show_id, year:payload->>first_air_date, networks:payload->networks')
          .in('tmdb_show_id', showIds),
      ]);
      const metaById = new Map<number, { year: string | null; network: string | null }>();
      for (const m of (metaRes.data ?? []) as {
        tmdb_show_id: number; year: string | null; networks: { name?: string }[] | null;
      }[]) {
        metaById.set(m.tmdb_show_id, {
          year: m.year ? m.year.slice(0, 4) : null, // "2019-03-24" → "2019"
          network: m.networks?.[0]?.name ?? null,
        });
      }
      const owner = ownerRes.data as { username: string; avatar_url: string | null } | null;

      return {
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        description: row.description,
        is_ranked: row.is_ranked,
        ownerUsername: owner?.username ?? null,
        ownerAvatarUrl: owner?.avatar_url ?? null,
        createdAt: row.created_at,
        bannerUrl: null, // no custom-banner column yet; the detail screen still renders the seam
        // Each row resolved to its OWN scope art + identity + key (resolveScope),
        // not the show's. year/network stay show-level (a season belongs to the show).
        items: itemRows.map((it) => {
          const card = cards.get(it.tmdb_show_id);
          const scoped = resolveScope(
            { tmdb_show_id: it.tmdb_show_id, season_number: it.season_number, episode_number: it.episode_number },
            card,
          );
          const meta = metaById.get(it.tmdb_show_id);
          return {
            tmdb_show_id: it.tmdb_show_id,
            season_number: it.season_number,
            episode_number: it.episode_number,
            name: scoped.title,
            poster_path: scoped.posterPath,
            backdrop_path: card?.backdrop_path ?? null,
            scopeKey: scoped.key,
            year: meta?.year ?? null,
            network: meta?.network ?? null,
          };
        }),
      };
    },
  });
}
