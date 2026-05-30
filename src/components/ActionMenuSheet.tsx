import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { colors, fonts, pad } from '@/theme';

export type MenuAction = { label: string; destructive?: boolean; onPress: () => void };

type Props = { visible: boolean; onClose: () => void; actions: MenuAction[] };

// A small owner-only action menu (Edit / Delete …) rendered as a bottom Sheet —
// Pilot's overlay convention (see Sheet.tsx). Generic so reviews and lists share
// it. Tapping an action closes the sheet first, then runs it (so a follow-up
// navigation or confirm Alert appears cleanly over the dismissed sheet).
export function ActionMenuSheet({ visible, onClose, actions }: Props) {
  // Size the sheet to its rows (+ the Cancel row) instead of the 560 default.
  const height = actions.length * 58 + 58 + 96;

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={height}>
      {actions.map((a) => (
        <Pressable key={a.label} style={styles.row} onPress={() => run(a.onPress)}>
          <Text style={[styles.label, a.destructive && { color: colors.red }]}>{a.label}</Text>
        </Pressable>
      ))}
      <View style={styles.hairline} />
      <Pressable style={styles.row} onPress={onClose}>
        <Text style={[styles.label, { color: colors.muted }]}>Cancel</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 17, paddingHorizontal: pad, alignItems: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  hairline: { height: 1, backgroundColor: colors.hairline },
});
