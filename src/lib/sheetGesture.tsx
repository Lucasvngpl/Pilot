// Tracks how many "back-swipe suppressors" are currently active, so the root
// <Stack> can disable the iOS edge-swipe-back while any are up. Two kinds register:
//   1. Open SHEETS — sibling OVERLAYS (not Modals), so the screen underneath stays
//      live and its edge swipe-to-go-back would otherwise steal a horizontal drag
//      inside the sheet and pop the screen mid-gesture.
//   2. Screens that run their OWN left-edge back-swipe (a GestureDetector pan, e.g.
//      the full-screen list pickers — list/new, ListItemPicker, ListBannerPicker):
//      they suppress the native gesture so the two recognizers don't both fire.
//
// NOT a registrant: the RatingPicker. It uses react-native-gesture-handler and
// claims a touch that begins on the (centered) stars, so UIKit's edge recognizer
// never arms for it — no screen-wide suppression needed. It used to suppress here,
// which needlessly killed swipe-back on every inline rating screen (PIL-15).
// In-sheet pickers are covered by kind #1 (the Sheet), not the picker.
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
