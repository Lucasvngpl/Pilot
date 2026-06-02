import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { fonts, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// An action can be a bare label (the owner-only Edit / Delete menus on reviews
// and lists) OR a "rich" row with a leading icon + a descriptive subtitle (the
// log/list picker off the "+" tab). `icon`/`description` are OPTIONAL so every
// existing caller keeps rendering exactly as before — they only opt in.
export type MenuAction = {
  label: string;
  description?: string;                                            // subtitle → renders the rich row
  icon?: React.ComponentType<{ color?: string; size?: number }>;  // leading glyph (same shape as the nav icons)
  destructive?: boolean;
  onPress: () => void;
};

type Props = { visible: boolean; onClose: () => void; actions: MenuAction[] };

// A bottom-sheet action menu rendered as Pilot's overlay (see Sheet.tsx).
// Two visual modes, picked automatically:
//   • bare    — centered single labels (Edit / Delete …)
//   • rich    — icon + title + subtitle, left-aligned (the log/list picker)
// Tapping an action closes the sheet FIRST, then runs it, so a follow-up
// navigation or confirm Alert appears cleanly over the dismissed sheet.
export function ActionMenuSheet({ visible, onClose, actions }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  // If any action carries an icon/description, render the whole sheet rich so
  // the rows align consistently. A rich menu is a "picker", so its dismiss row
  // reads "Close" (vs "Cancel" for the contextual bare menus).
  const rich = actions.some((a) => a.icon || a.description);
  const dismissLabel = rich ? 'Close' : 'Cancel';

  // Size the sheet to its rows (+ the dismiss row) instead of the 560 default.
  // Rich rows are taller (two lines of text). The trailing constant covers the
  // grabber + the breathing room above the home indicator.
  const rowH = rich ? 72 : 58;
  const height = actions.length * rowH + 58 + 96;

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={height}>
      {actions.map((a) => {
        const tint = a.destructive ? colors.red : colors.ink;
        const Icon = a.icon;
        return (
          <Pressable
            key={a.label}
            style={rich ? styles.richRow : styles.row}
            onPress={() => run(a.onPress)}
          >
            {rich ? (
              <>
                {/* Icon centered against the (up to) two-line text block. */}
                {Icon && <Icon color={tint} size={26} />}
                <View style={styles.richText}>
                  <Text style={[styles.title, { color: tint }]}>{a.label}</Text>
                  {a.description && <Text style={styles.desc}>{a.description}</Text>}
                </View>
              </>
            ) : (
              <Text style={[styles.label, a.destructive && { color: colors.red }]}>{a.label}</Text>
            )}
          </Pressable>
        );
      })}
      <View style={styles.hairline} />
      <Pressable style={rich ? styles.dismissRich : styles.row} onPress={onClose}>
        <Text style={[styles.label, { color: colors.muted }]}>{dismissLabel}</Text>
      </Pressable>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // Bare mode (Edit / Delete …): centered single label.
  row: { paddingVertical: 17, paddingHorizontal: pad, alignItems: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },

  // Rich mode (log/list picker): icon + stacked title/subtitle, left-aligned.
  richRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 13,
    paddingHorizontal: pad,
  },
  richText: { flex: 1 },
  title: { fontFamily: fonts.semibold, fontSize: 18 },
  desc: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2 },
  // Dismiss row in rich mode stays centered (it's a "Close", not a list item).
  dismissRich: { paddingVertical: 17, paddingHorizontal: pad, alignItems: 'center' },

  hairline: { height: 1, backgroundColor: colors.hairline },
});
