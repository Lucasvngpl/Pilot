import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { ScopeActions, type Scope } from '@/components/ScopeActions';
import { AddToListSheet } from '@/components/AddToListSheet';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';
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
// Owns only the chrome (Sheet + Close) and the AddToListSheet overlay — which is a
// SIBLING of the Sheet (full-screen overlay; never nest it inside the panel, per
// "Sheets are overlays" in CLAUDE.md). Anonymous users see the sheet; the gate is
// per-action inside ScopeActions. ShowActionSheet is the whole-show wrapper of this.
export function ScopeActionSheet({ visible, onClose, scope, currentStatus, currentRating }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [addToListOpen, setAddToListOpen] = useState(false);

  return (
    <>
      <Sheet visible={visible} onClose={onClose} height={560}>
        <ScopeActions
          scope={scope}
          currentStatus={currentStatus}
          currentRating={currentRating}
          onRequestClose={onClose}
          onAddToList={() => setAddToListOpen(true)}
        />

        <View style={styles.hairline} />
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  hairline: { height: 1, backgroundColor: colors.hairline },
  close: { paddingVertical: 18, alignItems: 'center' },
  closeText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});
