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

  return (
    <>
      {/* Sized to the content (pills · rating · 2 rows ≈ 330pt) + a little
          breathing room above the home indicator. Content height is the same at
          every scope — 1/2/3 status pills are all one row — so one height fits all. */}
      <Sheet visible={visible} onClose={onClose} height={380}>
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
