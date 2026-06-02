// SeasonPills — horizontally scrollable pill row for picking a season; active pill is ink-filled, inactive is outlined.
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { type, radius, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  seasons: number[];
  active: number;
  onChange: (n: number) => void;
  // Optional: long-press a season pill → that season's scope actions. Only the
  // Seasons browser passes this; the composer / log scope-pickers leave it off.
  onLongPress?: (n: number) => void;
};

export function SeasonPills({ seasons, active, onChange, onLongPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {seasons.map((n) => {
        const isActive = n === active;
        return (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            onLongPress={onLongPress ? () => onLongPress(n) : undefined}
            delayLongPress={280}
            style={[styles.pill, isActive ? styles.active : styles.inactive]}
          >
            <Text style={[
              isActive ? type.pillActive : type.pillInactive,
              // Active pill is ink-filled (inverts to light in dark), so the
              // label tracks `background` to stay contrasting in both modes.
              { color: isActive ? colors.background : colors.ink },
            ]}>
              Season {n}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: pad, paddingVertical: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  active:   { backgroundColor: colors.ink },
  inactive: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
});
