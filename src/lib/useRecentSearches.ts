import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type RecentKind = 'shows' | 'people';
export type RecentSearch = { query: string; kind: RecentKind };

const KEY = 'pilot.recentSearches.v1';
const MAX = 8;

/**
 * Per-device recent searches, backed by AsyncStorage. Newest first, deduped
 * case-insensitively per (query, kind), capped at MAX.
 *
 * Recorded when the user taps a result (see Search) — matching Letterboxd, where
 * the saved term is often the partial query that led to the tapped result.
 */
export function useRecentSearches() {
  const [recents, setRecents] = useState<RecentSearch[]>([]);

  // Load once on mount.
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(KEY).then((raw) => {
      if (!alive || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecents(parsed as RecentSearch[]);
      } catch {
        // Corrupt storage — ignore, start fresh.
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const add = useCallback((query: string, kind: RecentKind) => {
    const q = query.trim();
    if (!q) return;
    setRecents((prev) => {
      // Drop any existing match (case-insensitive), prepend, cap.
      const deduped = prev.filter(
        (r) => !(r.kind === kind && r.query.toLowerCase() === q.toLowerCase()),
      );
      const next = [{ query: q, kind }, ...deduped].slice(0, MAX);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecents([]);
    AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return { recents, add, clear };
}
