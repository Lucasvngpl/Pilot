// GenreChips — a horizontal, single-select genre row for Search › Shows. Turns
// the empty search box into a browse surface: tap a genre to filter the catalog.
// "All" clears back to trending; tapping the active chip also toggles it off.
// Single-select by design (multi-genre AND/OR is deferred).
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { TV_GENRES } from '@/lib/genres';
import { type, pad, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  selected: number | null; // genre id, or null = All (trending)
  onSelect: (id: number | null) => void;
};

export function GenreChips({ selected, onSelect }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Keep chip taps working when the keyboard is up (search box focused).
      keyboardShouldPersistTaps="handled"
    >
      <Chip label="All" active={selected === null} onPress={() => onSelect(null)} />
      {TV_GENRES.map((g) => (
        <Chip
          key={g.id}
          label={g.name}
          active={selected === g.id}
          // Re-tapping the active genre returns to All.
          onPress={() => onSelect(selected === g.id ? null : g.id)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      {/* Active chip is ink-filled (inverts to light in dark) → label tracks
          `background` so it stays contrasting in both modes. */}
      <Text style={[type.pillActive, { color: active ? colors.background : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { paddingHorizontal: pad, paddingTop: 12, paddingBottom: 4, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  chipIdle: { backgroundColor: colors.field },
  chipActive: { backgroundColor: colors.ink },
});
