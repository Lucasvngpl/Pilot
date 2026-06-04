// Tracks how many "back-swipe suppressors" are currently active, so the root
// <Stack> can disable the iOS edge-swipe-back while any are up. Two kinds register:
//   1. Open SHEETS — sibling OVERLAYS (not Modals), so the screen underneath stays
//      live and its edge swipe-to-go-back would otherwise steal a horizontal drag
//      inside the sheet and pop the screen mid-gesture.
//   2. A mounted RATING SLIDER (RatingPicker) — its stars sit only ~20px from the
//      left, INSIDE the iOS edge-swipe zone, so a drag-to-rate starting on the
//      leftmost stars would pop the screen. We suppress while the slider is MOUNTED
//      (not just mid-drag): a mid-drag toggle can land too late to cancel an
//      already-armed native recognizer.
//
// Why a global count instead of per-screen `navigation.setOptions`: the LoginSheet
// and the long-press ShowActionSheet mount OUTSIDE the <Stack>, where there's no
// screen navigation to target. A count lives above everything; AuthGate (which owns
// the Stack) reads it and toggles `gestureEnabled` for whatever screen is focused.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Api = { inc: () => void; dec: () => void };

// Split count from the API so registering a sheet doesn't re-run on every count
// change (the API object is stable; only the count value churns).
const CountCtx = createContext(0);
const ApiCtx = createContext<Api>({ inc: () => {}, dec: () => {} });

export function SheetGestureProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const api = useMemo<Api>(
    () => ({
      inc: () => setCount((c) => c + 1),
      dec: () => setCount((c) => Math.max(0, c - 1)),
    }),
    [],
  );
  return (
    <ApiCtx.Provider value={api}>
      <CountCtx.Provider value={count}>{children}</CountCtx.Provider>
    </ApiCtx.Provider>
  );
}

/**
 * Suppress the edge-swipe-back while `active` is true (counts up, then down on
 * false / unmount). The general primitive — sheets and the rating slider both use
 * it. See the module header for why the RatingPicker suppresses while MOUNTED.
 */
export function useSuppressBackSwipe(active: boolean) {
  const { inc, dec } = useContext(ApiCtx);
  useEffect(() => {
    if (!active) return;
    inc();
    return dec;
  }, [active, inc, dec]);
}

/** Sheets call this with their `visible` — same mechanism, sheet-flavored name. */
export const useRegisterSheet = useSuppressBackSwipe;

/** The Stack owner reads this to disable back-swipe while any suppressor is active. */
export function useAnySheetOpen() {
  return useContext(CountCtx) > 0;
}
