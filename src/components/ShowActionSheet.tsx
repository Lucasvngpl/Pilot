import { ScopeActionSheet } from '@/components/ScopeActionSheet';
import type { WatchStatus } from '@/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  tmdbShowId: number;
  currentStatus: WatchStatus | null;
  currentRating: number | null;
};

// The WHOLE-SHOW entry point into the scoped action sheet — a thin wrapper that
// feeds <ScopeActionSheet> the show-scope tuple (season/episode null). Kept as its
// own name because the show-detail screens + the long-press provider open it by
// show id; sub-scope callers use ScopeActionSheet / the scope sheet directly.
export function ShowActionSheet({ visible, onClose, tmdbShowId, currentStatus, currentRating }: Props) {
  return (
    <ScopeActionSheet
      visible={visible}
      onClose={onClose}
      scope={{ tmdb_show_id: tmdbShowId, season_number: null, episode_number: null }}
      currentStatus={currentStatus}
      currentRating={currentRating}
    />
  );
}
