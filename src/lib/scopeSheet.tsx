// scopeSheet.tsx — ScopeSheetProvider + useScopeSheet: one root-mounted
// ScopeActionSheet that a long-press (poster, episode row, …) can open at ANY
// scope without navigating. Like the global LoginSheet, ONE sheet lives at the
// root so a long-press on something nested deep in a scroll view can open it and
// its full-screen overlay covers the page instead of being clipped inside a list.
import { createContext, useCallback, useContext, useState } from 'react';
import { useShow } from '@/api/useShow';
import { ScopeActionSheet } from '@/components/ScopeActionSheet';
import type { Scope } from '@/components/ScopeActions';

// openScopeSheet(scope) pops the action sheet (rate / status / review / add-to-
// list) for that scope over the current screen.
type OpenScopeSheet = (scope: Scope) => void;

const Ctx = createContext<OpenScopeSheet | null>(null);

export function ScopeSheetProvider({ children }: { children: React.ReactNode }) {
  // `scope` stays set through the close animation (the Sheet animates on
  // `visible`), so the sheet keeps rendering the right scope as it slides away.
  const [scope, setScope] = useState<Scope | null>(null);
  const [visible, setVisible] = useState(false);

  const open = useCallback<OpenScopeSheet>((s) => {
    setScope(s);
    setVisible(true);
  }, []);

  // Source the scope's current status + rating exactly like the show screen does.
  // useShow is `enabled`-gated, so passing undefined while closed means NO fetch;
  // once opened it hits the get-show cache (or fetches once). Because useRate /
  // useSetWatchStatus / useToggleEpisodeWatched optimistically patch this same
  // ['show', id] cache, tapping a pill/star here updates the sheet instantly — and
  // it pre-reflects whatever you'd already set AT THIS SCOPE. Scope-match in JS
  // with === null (never a SQL join), per CLAUDE.md's polymorphic-scope rule.
  const { data } = useShow(scope?.tmdb_show_id);
  const match = (r: { season_number: number | null; episode_number: number | null }) =>
    r.season_number === (scope?.season_number ?? null) && r.episode_number === (scope?.episode_number ?? null);
  const currentStatus = data?.mySocial.watch_statuses.find(match)?.status ?? null;
  const currentRating = data?.mySocial.ratings.find(match)?.score ?? null;

  return (
    <Ctx.Provider value={open}>
      {children}
      <ScopeActionSheet
        visible={visible}
        onClose={() => setVisible(false)}
        scope={scope ?? { tmdb_show_id: 0, season_number: null, episode_number: null }}
        currentStatus={currentStatus}
        currentRating={currentRating}
      />
    </Ctx.Provider>
  );
}

export function useScopeSheet(): OpenScopeSheet {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('useScopeSheet must be used inside <ScopeSheetProvider>');
  return fn;
}
