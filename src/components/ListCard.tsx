import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { tmdbImage } from '@/types';
import type { ListSummary } from '@/types';

// A list row on the Lists tab: a fanned stack of up to 4 poster thumbnails +
// title + show count. Tap → /list/[id] by default; `onPress` overrides it (the
// Drafts page sends drafts to the composer instead of the public detail).
export function ListCard({ list, onPress }: { list: ListSummary; onPress?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.row} onPress={onPress ?? (() => router.push(`/list/${list.id}` as any))}>
      {/* FIXED-WIDTH cluster: every row's art occupies the same footprint (room
          for 3 fanned posters), regardless of how many it actually holds — so the
          title column always starts at the same x and the titles align. A list
          with 1 poster fills less of the box but takes the same width. */}
      <View style={styles.posters}>
        {list.posters.length === 0 ? (
          <View style={styles.thumb} />
        ) : (
          list.posters.slice(0, 3).map((p, i) => {
            const uri = tmdbImage(p, 'w185');
            return uri ? (
              <Image
                key={i}
                source={{ uri }}
                style={[styles.thumb, i > 0 && styles.overlap]}
                contentFit="cover"
              />
            ) : (
              <View key={i} style={[styles.thumb, i > 0 && styles.overlap]} />
            );
          })
        )}
      </View>
      <View style={styles.text}>
        <Text style={[type.reviewTitle, { color: colors.ink }]} numberOfLines={1}>
          {list.title}
        </Text>
        <Text style={[type.filter, { color: colors.muted, marginTop: 2 }]}>
          {list.countLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  // Fixed footprint = 3 fanned posters (38 + 2×16 overlap-step = 70). Left-aligned,
  // so fewer posters just leave empty space on the right of the SAME-width box —
  // the single mechanism that lines every title up (no per-row text padding).
  posters: { width: 70, height: 57, flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 38,
    height: 57,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    borderWidth: 1,
    // Background-colored stroke = a "cutout" between the fanned posters.
    borderColor: colors.background,
  },
  overlap: { marginLeft: -22 }, // fan the posters (overlap-step = 38−22 = 16)
  text: { flex: 1 },
});
