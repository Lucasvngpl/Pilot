// DatePickerRow (native) — a "Watched on · <date>" row whose right side is a
// SwiftUI compact DatePicker (a tappable date chip that pops Apple's calendar).
// Web has its own variant (DatePickerRow.web.tsx) using <input type="date">.
//
// Uses @expo/ui (already a dependency). Every SwiftUI tree must be wrapped in
// <Host>; `matchContents` sizes the host to the picker. The picker speaks Date
// objects; we convert to/from the "YYYY-MM-DD" string the rest of the app uses.
import { View, Text, StyleSheet } from 'react-native';
import { Host, DatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { toLocalDate, fromLocalDate } from '@/types';

type Props = {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  label?: string;
};

export function DatePickerRow({ value, onChange, label = 'Watched on' }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { mode } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {/* colorScheme tracks the app theme so the picker reads correctly in dark.
          range caps the end at today — you can't have watched something tomorrow. */}
      <Host matchContents colorScheme={mode} style={styles.host}>
        <DatePicker
          selection={toLocalDate(value)}
          displayedComponents={['date']}
          range={{ end: new Date() }}
          onDateChange={(d) => onChange(fromLocalDate(d))}
          modifiers={[datePickerStyle('compact')]}
        />
      </Host>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // No horizontal padding — the host screen pads its content; this aligns flush
  // with the other composer rows (RatingPicker / TextField).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  host: { minHeight: 34 },
});
