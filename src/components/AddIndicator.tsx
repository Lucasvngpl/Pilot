// AddIndicator — two-state add/select indicator: a subtle empty ring (not added)
// that flips to a filled purple circle + white ✓ (added). Shared by the list add
// picker (ListItemPicker) and bulk mark-watched, so the affordance reads the same.
import { View, StyleSheet } from 'react-native';
import { CheckIcon } from '@/components/icons';
import { type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export function AddIndicator({ added }: { added: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.indicator, added && styles.indicatorOn]}>
      {added && <CheckIcon color={colors.white} size={11} />}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // NOT added: a subtle ring (transparent fill, low-contrast stroke — intentional).
  indicator: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.faint,
    alignItems: 'center', justifyContent: 'center',
  },
  // ADDED: filled accent circle with the white ✓.
  indicatorOn: { backgroundColor: colors.purple, borderColor: colors.purple },
});
