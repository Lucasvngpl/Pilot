// DatePickerRow (web) — the @expo/ui SwiftUI picker renders nothing on web, so
// here we use a native HTML <input type="date">. react-dom renders it directly;
// it returns "YYYY-MM-DD", matching our date column with zero parsing. `max` caps
// the selectable day at today. Keep this in sync with DatePickerRow.tsx (native).
import { View, Text, StyleSheet } from 'react-native';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { todayLocal } from '@/types';

type Props = {
  value: string; // "YYYY-MM-DD"
  onChange: (date: string) => void;
  label?: string;
};

export function DatePickerRow({ value, onChange, label = 'Watched on' }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="date"
        value={value}
        max={todayLocal()}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          fontFamily: fonts.medium,
          fontSize: 15,
          color: colors.ink,
          background: 'transparent',
          border: 'none',
          colorScheme: 'light dark', // lets the browser theme the native picker UI
        }}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // No horizontal padding — the host screen pads its content (matches native).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  label: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});
