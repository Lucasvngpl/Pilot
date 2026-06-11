import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import { formatScope, resolveScope } from '@/types';
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

// A diary page carries the visible entries PLUS whether the RAW fetch reached the
// end. We hide subsumed rows (a marked season hides its episodes — see below) for
// display, but paginate on the raw count: a page filtered down to <PAGE_SIZE would
// otherwise look like the last page and stop infinite scroll prematurely.
type DiaryPage = { entries: DiaryEntry[]; reachedEnd: boolean };

/**
 * The Diary — a chronological log of every WATCHED event (whole-show / season /
 * episode), newest first, ordered by the user-chosen `watched_at` day (then
 * `updated_at` as the intra-day tiebreak). Unlike the Profile grids this does NOT
 * aggregate up to the show: each `watched` row is its own entry, labelled with its
 * scope. Each entry carries the rating + review for that EXACT scope (JS merge).
 *
 * Subsumption: a higher-scope watched mark HIDES the lower ones (you marked the
 * whole season → see "Season 1", not 8 episodes). Display-only — the rows still
 * exist, drive Shows/ratings, and reappear if you un-mark.
 *
 * Paginated: returns `DiaryPage`s. The screen flattens `page.entries` + groups into
 * month bands at render (grouping spans page boundaries cleanly because the order
 * is stable across pages).
 */
export function useDiary(userId: string | undefined) {
  return useInfiniteQuery<DiaryPage>({
    queryKey: ['diary', userId],
    enabled: !!userId,
    initialPageParam: 0,
    // Reached the end of the RAW rows → no more pages. Otherwise the next offset is
    // pages-loaded × PAGE_SIZE (stable because the order is deterministic).
    getNextPageParam: (lastPage, allPages) =>
      lastPage.reachedEnd ? undefined : allPages.length * PAGE_SIZE,
    queryFn: async ({ pageParam }) => {
      const id = userId!;
      const from = pageParam as number;
      const to = from + PAGE_SIZE - 1;

      const { data: rows, error } = await supabase
        .from('watch_status')
        .select('tmdb_show_id, season_number, episode_number, watched_at, updated_at')
        .eq('user_id', id)
        .eq('status', 'watched')
        // Backlog marks (from_backlog=true, watched_at=NULL) are "I've seen these",
        // not dated events — exclude them from the event-level Diary.
        .eq('from_backlog', false)
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
      // Paginate on the raw count, BEFORE subsumption trims the page.
      const reachedEnd = watched.length < PAGE_SIZE;
      if (watched.length === 0) return { entries: [], reachedEnd: true };

      // Covering rows: a show-scope `watched` row (season null) hides ALL that
      // show's season+episode entries; a season-scope row hides its episodes. One
      // small query (these rows are few). from_backlog excluded — a "seen it"
      // backlog mark shouldn't erase your dated episode logs from the Diary.
      const { data: covRows } = await supabase
        .from('watch_status')
        .select('tmdb_show_id, season_number')
        .eq('user_id', id)
        .eq('status', 'watched')
        .eq('from_backlog', false)
        .is('episode_number', null);
      const showCovered = new Set<number>();
      const seasonCovered = new Set<string>(); // `${showId}:${season}`
      for (const r of (covRows ?? []) as { tmdb_show_id: number; season_number: number | null }[]) {
        if (r.season_number == null) showCovered.add(r.tmdb_show_id);
        else seasonCovered.add(`${r.tmdb_show_id}:${r.season_number}`);
      }
      // Keep only rows NOT subsumed by a higher-scope mark. A whole-show entry is
      // top scope (never hidden); a season entry hides under a show mark; an
      // episode entry hides under either a show or its season mark.
      const visible = watched.filter((w) => {
        if (w.season_number == null && w.episode_number == null) return true;
        if (showCovered.has(w.tmdb_show_id)) return false;
        if (w.episode_number != null && seasonCovered.has(`${w.tmdb_show_id}:${w.season_number}`)) return false;
        return true;
      });
      if (visible.length === 0) return { entries: [], reachedEnd };

      const ids = [...new Set(visible.map((r) => r.tmdb_show_id))];

      const [cards, yearRes, ratingRes, reviewRes] = await Promise.all([
        // withScopeArt so each entry can show its OWN scope's art — an episode's
        // still, a season's poster — not just the show poster (PIL-12).
        fetchShowCards(ids, { withScopeArt: true }), // name + poster (lazy-caches any uncached show)
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

      const entries = visible.map((w): DiaryEntry => {
        // watched_at is a "YYYY-MM-DD" calendar day. Split-parse (NOT new Date(str),
        // which is UTC and can shift the day) for the day cell; the screen derives
        // the month band the same way.
        const day = Number(w.watched_at.split('-')[2]);
        const card = cards.get(w.tmdb_show_id);
        const k = scopeKey(w.tmdb_show_id, w.season_number, w.episode_number);
        // Scope-aware art: episode → its still, season → season poster, whole show
        // → show poster (resolveScope walks that fallback). `name` stays the SHOW
        // name — the row shows the scope separately via scopeLabel (PIL-12).
        const scoped = resolveScope(
          { tmdb_show_id: w.tmdb_show_id, season_number: w.season_number, episode_number: w.episode_number },
          card,
        );
        return {
          key: `${k}:${w.watched_at}:${w.updated_at}`,
          tmdb_show_id: w.tmdb_show_id,
          seasonNumber: w.season_number,
          episodeNumber: w.episode_number,
          name: card?.name ?? 'Untitled',
          poster_path: scoped.posterPath,
          year: yearByShow.get(w.tmdb_show_id) ?? null,
          scopeLabel: formatScope(w.season_number, w.episode_number) ?? null,
          watchedAt: w.watched_at,
          day,
          rating: ratingByScope.get(k) ?? null,
          hasReview: reviewedScopes.has(k),
        };
      });
      return { entries, reachedEnd };
    },
  });
}
