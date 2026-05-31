// showSheet.tsx — ShowSheetProvider + useShowSheet: one root-mounted ShowActionSheet that any poster long-press can open without navigating.
import { createContext, useCallback, useContext, useState } from 'react';
import { useShow } from '@/api/useShow';
import { ShowActionSheet } from '@/components/ShowActionSheet';

// openShowSheet(id) pops the show's action sheet (rate / status / add-to-list)
// over the current screen. ONE sheet is mounted at the root — like the global
// LoginSheet (RequireAuthProvider) — so a long-press on a poster nested deep
// inside any scroll view can open it, and its full-screen overlay covers the
// page instead of being clipped inside a list.
type OpenShowSheet = (tmdbShowId: number) => void;

const Ctx = createContext<OpenShowSheet | null>(null);

export function ShowSheetProvider({ children }: { children: React.ReactNode }) {
  // `showId` stays set through the close animation (the Sheet animates on
  // `visible`), so the sheet keeps rendering the right show as it slides away.
  const [showId, setShowId] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  const open = useCallback<OpenShowSheet>((id) => {
    setShowId(id);
    setVisible(true);
  }, []);

  // Source the show's current status + rating exactly like the show screen does.
  // useShow is `enabled`-gated, so passing undefined while closed means NO fetch;
  // once opened it hits the get-show cache (or fetches once). Because useRate /
  // useSetWatchStatus optimistically patch this same ['show', id] cache, tapping
  // a pill/star here updates the sheet instantly — and the sheet pre-reflects any
  // rating/status you'd already set, matching what you'd see on the show screen.
  const { data } = useShow(showId ?? undefined);
  const currentStatus =
    data?.mySocial.watch_statuses.find((r) => r.season_number === null && r.episode_number === null)
      ?.status ?? null;
  const currentRating =
    data?.mySocial.ratings.find((r) => r.season_number === null && r.episode_number === null)
      ?.score ?? null;

  return (
    <Ctx.Provider value={open}>
      {children}
      <ShowActionSheet
        visible={visible}
        onClose={() => setVisible(false)}
        tmdbShowId={showId ?? 0}
        currentStatus={currentStatus}
        currentRating={currentRating}
      />
    </Ctx.Provider>
  );
}

export function useShowSheet(): OpenShowSheet {
  const fn = useContext(Ctx);
  if (!fn) throw new Error('useShowSheet must be used inside <ShowSheetProvider>');
  return fn;
}
