import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import { formatScope } from '@/types';
import type { DiaryEntry } from '@/types';

// Diary pages: fetch 50 events at a time, oldest reachable via infinite scroll.
// (Was a single LIMIT-100 fetch — which silently dropped your oldest events once
// you had >100, e.g. a show logged years back never appeared. Pagination fixes
// that AND keeps each open fast: we don't load your whole history up front.)
const PAGE_SIZE = 50;

// Scope key for the JS cross-table merge. CLAUDE.md rule: never match scoped
// tables in SQL (NULL ≠ NULL silently drops whole-show rows). A string key
// serializes null consistently on both sides, so whole-show ↔ whole-show matches.
const scopeKey = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

/**
 * The Diary — a chronological log of every WATCHED event (whole-show / season /
 * episode), newest first, ordered by the user-chosen `watched_at` day (then
 * `updated_at` as the intra-day tiebreak). Unlike the Profile grids this does NOT
 * aggregate up to the show: each `watched` row is its own entry, labelled with its
 * scope. Each entry carries the rating + review for that EXACT scope (JS merge).
 *
 * Paginated: returns pages of flat `DiaryEntry[]`. The screen flattens + groups
 * into month bands at render (grouping spans page boundaries cleanly because the
 * order is stable across pages).
 */
export function useDiary(userId: string | undefined) {
  return useInfiniteQuery<DiaryEntry[]>({
    queryKey: ['diary', userId],
    enabled: !!userId,
    initialPageParam: 0,
    // A short page means we've reached the end. Otherwise the next offset is
    // simply pages-loaded × PAGE_SIZE (stable because the order is deterministic).
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length * PAGE_SIZE,
    queryFn: async ({ pageParam }) => {
      const id = userId!;
      const from = pageParam as number;
      const to = from + PAGE_SIZE - 1;

      const { data: rows, error } = await supabase
        .from('watch_status')
        .select('tmdb_show_id, season_number, episode_number, watched_at, updated_at')
        .eq('user_id', id)
        .eq('status', 'watched')
        .order('watched_at', { ascending: false })
        .order('updated_at', { ascending: false })
        .range(from, to);
      if (error) throw error;

      const watched = (rows ?? []) as {
        tmdb_show_id: number;
        season_number: number | null;
        episode_number: number | null;
        watched_at: string; // "YYYY-MM-DD"
        updated_at: string;
      }[];
      if (watched.length === 0) return [];

      const ids = [...new Set(watched.map((r) => r.tmdb_show_id))];

      const [cards, yearRes, ratingRes, reviewRes] = await Promise.all([
        fetchShowCards(ids), // name + poster (lazy-caches any uncached show)
        supabase.from('shows_cache').select('tmdb_show_id, year:payload->>first_air_date').in('tmdb_show_id', ids),
        supabase.from('ratings').select('tmdb_show_id, season_number, episode_number, score').eq('user_id', id).in('tmdb_show_id', ids),
        supabase.from('reviews').select('tmdb_show_id, season_number, episode_number').eq('user_id', id).eq('is_draft', false).in('tmdb_show_id', ids),
      ]);

      const yearByShow = new Map<number, string | null>();
      for (const r of (yearRes.data ?? []) as { tmdb_show_id: number; year: string | null }[]) {
        yearByShow.set(r.tmdb_show_id, r.year ? r.year.slice(0, 4) : null); // "1972-03-24" → "1972"
      }
      const ratingByScope = new Map<string, number>();
      for (const r of (ratingRes.data ?? []) as {
        tmdb_show_id: number; season_number: number | null; episode_number: number | null; score: number;
      }[]) {
        ratingByScope.set(scopeKey(r.tmdb_show_id, r.season_number, r.episode_number), r.score);
      }
      const reviewedScopes = new Set<string>();
      for (const r of (reviewRes.data ?? []) as {
        tmdb_show_id: number; season_number: number | null; episode_number: number | null;
      }[]) {
        reviewedScopes.add(scopeKey(r.tmdb_show_id, r.season_number, r.episode_number));
      }

      return watched.map((w): DiaryEntry => {
        // watched_at is a "YYYY-MM-DD" calendar day. Split-parse (NOT new Date(str),
        // which is UTC and can shift the day) for the day cell; the screen derives
        // the month band the same way.
        const day = Number(w.watched_at.split('-')[2]);
        const card = cards.get(w.tmdb_show_id);
        const k = scopeKey(w.tmdb_show_id, w.season_number, w.episode_number);
        return {
          key: `${k}:${w.watched_at}:${w.updated_at}`,
          tmdb_show_id: w.tmdb_show_id,
          name: card?.name ?? 'Untitled',
          poster_path: card?.poster_path ?? null,
          year: yearByShow.get(w.tmdb_show_id) ?? null,
          scopeLabel: formatScope(w.season_number, w.episode_number) ?? null,
          watchedAt: w.watched_at,
          day,
          rating: ratingByScope.get(k) ?? null,
          hasReview: reviewedScopes.has(k),
        };
      });
    },
  });
}
