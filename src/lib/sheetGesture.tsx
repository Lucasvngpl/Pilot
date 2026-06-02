// Tracks how many sheets are currently open, so the root <Stack> can disable the
// iOS back-swipe while ANY sheet is up. Sheets are sibling OVERLAYS (not Modals),
// so the screen underneath stays live and its edge swipe-to-go-back would otherwise
// steal a horizontal drag inside the sheet (the drag-to-rate star slider especially)
// and pop the screen mid-gesture.
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

/** Sheets call this with their `visible` — counts up while open, down on close. */
export function useRegisterSheet(visible: boolean) {
  const { inc, dec } = useContext(ApiCtx);
  useEffect(() => {
    if (!visible) return;
    inc();
    return dec;
  }, [visible, inc, dec]);
}

/** The Stack owner reads this to disable back-swipe while any sheet is open. */
export function useAnySheetOpen() {
  return useContext(CountCtx) > 0;
}
