// onboarding.tsx — first-run onboarding state, lifted to the root so it survives
// navigation AND the OAuth browser round-trip.
//
// Two jobs:
//  1. The "seen" flag (AsyncStorage). A brand-new install hasn't seen onboarding →
//     AuthGate routes it to /onboarding ONCE. After the user finishes OR skips, the
//     flag flips true and they're a normal browse-free user forever after (returning
//     anonymous browsers are never re-walled — that's the whole point of the flag).
//  2. The in-progress selections. Onboarding step 1 (shows you've watched) and step 2
//     (starter recommendations → watchlist) collect tmdb ids LOCALLY while the user is
//     still anonymous — nothing is written until they sign in (writes need auth.uid()).
//     The moment a session lands we FLUSH them in two batched RPCs, then clear.
//
// Lives inside AuthProvider + QueryClientProvider so it can read the session and
// invalidate the Profile aggregation queries the flush feeds.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const SEEN_KEY = 'pilot.onboarding.seen.v1';

type OnboardingState = {
  // null while the AsyncStorage read is in flight — AuthGate holds the UI until
  // it resolves so it doesn't flash the wrong screen (same discipline as theme).
  seen: boolean | null;
  // Step 1: shows the user has already watched → bulk_mark_watched (backlog, undated).
  watched: Set<number>;
  // Step 2: recommended shows the user wants to watch → bulk_add_watchlist.
  watchlist: Set<number>;
  toggleWatched: (id: number) => void;
  toggleWatchlist: (id: number) => void;
  // True while the post-sign-in flush is writing — the sign-in step shows a brief
  // "Setting things up…" state and waits for this to clear before leaving.
  flushing: boolean;
  // Skip onboarding: discard the in-progress picks (the user chose not to save) and
  // mark seen so they land in the app as an anonymous browser.
  skip: () => void;
};

const Ctx = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const qc = useQueryClient();

  const [seen, setSeen] = useState<boolean | null>(null);
  const [watched, setWatched] = useState<Set<number>>(new Set());
  const [watchlist, setWatchlist] = useState<Set<number>>(new Set());
  const [flushing, setFlushing] = useState(false);

  // Mirror the selection sets into refs so the flush effect can read the LATEST
  // picks while depending only on `session` (we don't want it re-running — and
  // re-flushing — on every toggle).
  const watchedRef = useRef(watched);
  watchedRef.current = watched;
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;
  // Guards the flush to exactly once per app session (a session refresh fires
  // onAuthStateChange again; without this we'd double-write).
  const flushedRef = useRef(false);

  // Hydrate the seen flag once on mount.
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(false)); // storage error → treat as not-seen (safe default)
  }, []);

  const persistSeen = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {}); // best-effort; UI already flipped
  }, []);

  const toggleWatched = useCallback((id: number) => {
    setWatched((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleWatchlist = useCallback((id: number) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const skip = useCallback(() => {
    setWatched(new Set());
    setWatchlist(new Set());
    flushedRef.current = true; // nothing to flush; block the effect from acting
    persistSeen();
  }, [persistSeen]);

  // Flush on the first session of this app run. Email or OAuth, onboarding or the
  // per-action gate — once we have auth.uid() we persist whatever the user picked.
  useEffect(() => {
    if (!session) return;
    persistSeen(); // signing in (anywhere) means they've effectively onboarded
    if (flushedRef.current) return;

    const watchedIds = [...watchedRef.current];
    const watchlistIds = [...watchlistRef.current];
    if (watchedIds.length === 0 && watchlistIds.length === 0) {
      flushedRef.current = true;
      return;
    }

    flushedRef.current = true;
    setFlushing(true);
    (async () => {
      try {
        // Two non-destructive batched RPCs (see 0015 / 0016): status-only on
        // conflict, so re-running never clobbers a richer existing row.
        if (watchedIds.length) await supabase.rpc('bulk_mark_watched', { ids: watchedIds });
        if (watchlistIds.length) await supabase.rpc('bulk_add_watchlist', { ids: watchlistIds });
        // Mark the Profile aggregation queries stale so the grids reflect the
        // imported backlog/watchlist on the next Profile open (same keys the
        // watch-status mutations invalidate).
        qc.invalidateQueries({ queryKey: ['watched'] });
        qc.invalidateQueries({ queryKey: ['watching'] });
        qc.invalidateQueries({ queryKey: ['watchlist'] });
      } catch (e) {
        // Non-fatal: the user is signed in and in the app; a failed import just
        // means an empty Profile they can fill manually. Log, don't block.
        console.error('[onboarding] selection flush failed:', e);
      } finally {
        setWatched(new Set());
        setWatchlist(new Set());
        setFlushing(false);
      }
    })();
    // Only react to session transitions; selections are read via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <Ctx.Provider
      value={{ seen, watched, watchlist, toggleWatched, toggleWatchlist, flushing, skip }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}
