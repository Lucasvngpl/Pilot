import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import { formatScope } from '@/types';
import type { DiaryEntry, DiarySection } from '@/types';

const LIMIT = 100; // newest 100 watched events — pagination deferred

// Scope key for the JS cross-table merge. CLAUDE.md rule: never match scoped
// tables in SQL (NULL ≠ NULL silently drops whole-show rows). A string key
// serializes null consistently on both sides, so whole-show ↔ whole-show matches.
const scopeKey = (showId: number, s: number | null, e: number | null) => `${showId}:${s}:${e}`;

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * The Diary — a chronological, month-grouped log of every WATCHED event
 * (whole-show / season / episode), newest first. Unlike the Profile grids this
 * does NOT aggregate up to the show: a diary is event-level by nature, so each
 * watch_status `watched` row is its own entry, labelled with its scope. Each
 * entry carries the rating + review for that EXACT scope (merged in JS).
 */
export function useDiary(userId: string | undefined) {
  return useQuery<DiarySection[]>({
    queryKey: ['diary', userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId!;

      const { data: rows, error } = await supabase
        .from('watch_status')
        .select('tmdb_show_id, season_number, episode_number, updated_at')
        .eq('user_id', id)
        .eq('status', 'watched')
        .order('updated_at', { ascending: false })
        .limit(LIMIT);
      if (error) throw error;

      const watched = (rows ?? []) as {
        tmdb_show_id: number;
        season_number: number | null;
        episode_number: number | null;
        updated_at: string;
      }[];
      if (watched.length === 0) return [];

      const ids = [...new Set(watched.map((r) => r.tmdb_show_id))];

      const [cards, yearRes, ratingRes, reviewRes] = await Promise.all([
        fetchShowCards(ids), // name + poster (lazy-caches any uncached show)
        supabase.from('shows_cache').select('tmdb_show_id, year:payload->>first_air_date').in('tmdb_show_id', ids),
        supabase.from('ratings').select('tmdb_show_id, season_number, episode_number, score').eq('user_id', id).in('tmdb_show_id', ids),
        supabase.from('reviews').select('tmdb_show_id, season_number, episode_number').eq('user_id', id).in('tmdb_show_id', ids),
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

      // Build entries and group into month bands. `watched` is already newest-first,
      // so we can append to the last section while the month matches.
      const sections: DiarySection[] = [];
      for (const w of watched) {
        const d = new Date(w.updated_at); // local time — the day you logged it
        const month = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        const card = cards.get(w.tmdb_show_id);
        const k = scopeKey(w.tmdb_show_id, w.season_number, w.episode_number);

        const entry: DiaryEntry = {
          key: `${k}:${w.updated_at}`,
          tmdb_show_id: w.tmdb_show_id,
          name: card?.name ?? 'Untitled',
          poster_path: card?.poster_path ?? null,
          year: yearByShow.get(w.tmdb_show_id) ?? null,
          scopeLabel: formatScope(w.season_number, w.episode_number) ?? null,
          watchedAt: w.updated_at,
          day: d.getDate(),
          rating: ratingByScope.get(k) ?? null,
          hasReview: reviewedScopes.has(k),
        };

        const last = sections[sections.length - 1];
        if (last && last.month === month) last.entries.push(entry);
        else sections.push({ month, entries: [entry] });
      }
      return sections;
    },
  });
}
