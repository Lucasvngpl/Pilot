// SeasonPills — horizontally scrollable pill row for picking a season; active pill is ink-filled, inactive is outlined.
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { colors, type, radius, pad } from '@/theme';

type Props = {
  seasons: number[];
  active: number;
  onChange: (n: number) => void;
};

export function SeasonPills({ seasons, active, onChange }: Props) {
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
            style={[styles.pill, isActive ? styles.active : styles.inactive]}
          >
            <Text style={[
              isActive ? type.pillActive : type.pillInactive,
              { color: isActive ? colors.white : colors.ink },
            ]}>
              Season {n}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: pad, paddingVertical: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  active:   { backgroundColor: colors.ink },
  inactive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline },
});
