import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { ScopeActions, type Scope } from '@/components/ScopeActions';
import { AddToListSheet } from '@/components/AddToListSheet';
import type { WatchStatus } from '@/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  scope: Scope;
  // Status + rating AT this scope, derived by the host from the show's social rows.
  currentStatus: WatchStatus | null;
  currentRating: number | null;
};

// The bottom-sheet host for <ScopeActions> at ANY scope (show / season / episode).
// Owns only the chrome (the Sheet) and the AddToListSheet overlay — which is a
// SIBLING of the Sheet (full-screen overlay; never nest it inside the panel, per
// "Sheets are overlays" in CLAUDE.md). Dismiss by tapping the scrim — no Close
// row (it's redundant with the tap-to-dismiss). ShowActionSheet wraps this for
// whole-show. Anonymous users see the sheet; the gate is per-action in ScopeActions.
export function ScopeActionSheet({ visible, onClose, scope, currentStatus, currentRating }: Props) {
  const [addToListOpen, setAddToListOpen] = useState(false);

  // Sized to the content (pills · rating · action rows) + breathing room above the
  // home indicator. Show/episode scope = 2 action rows (Review · Add to list) ≈
  // 380pt; SEASON scope adds a 3rd row ("Mark all episodes watched"), so it needs
  // one row (~52pt) more — the Sheet is fixed-height with no inner scroll, so an
  // under-sized height would clip that row off the bottom.
  const isSeason = scope.season_number != null && scope.episode_number == null;

  return (
    <>
      <Sheet visible={visible} onClose={onClose} height={isSeason ? 432 : 380}>
        <ScopeActions
          scope={scope}
          currentStatus={currentStatus}
          currentRating={currentRating}
          onRequestClose={onClose}
          onAddToList={() => setAddToListOpen(true)}
        />
      </Sheet>

      <AddToListSheet
        visible={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        tmdbShowId={scope.tmdb_show_id}
        scope={{ season_number: scope.season_number, episode_number: scope.episode_number }}
      />
    </>
  );
}
