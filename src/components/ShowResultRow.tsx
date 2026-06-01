import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Poster } from '@/components/Poster';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { SearchShowResult } from '@/types';

// One row in a show list — used for BOTH Trending and search results. Both
// sources hand it a SearchShowResult (useTrendingShows and search-shows each
// return that slim shape), so trending and search rows render identically.
//
// Tapping → /show/[id]. If the show isn't cached yet (common for search hits
// beyond the seeded set), get-show fetches + caches it on that first view.
export function ShowResultRow({
  item,
  onActivate,
  logMode,
}: {
  item: SearchShowResult;
  onActivate?: () => void; // fired before navigation — used to record a recent search
  logMode?: boolean; // "pick a show to log" → route straight to the composer, not show detail
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const year = item.first_air_date ? item.first_air_date.slice(0, 4) : null;
  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        onActivate?.();
        router.push(logMode ? `/show/${item.tmdb_show_id}/review` : `/show/${item.tmdb_show_id}`);
      }}
    >
      <Poster
        tmdbShowId={item.tmdb_show_id}
        posterPath={item.poster_path}
        name={item.name}
        width={48}
        pressable={false}
      />
      <View style={styles.text}>
        <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>
          {item.name}
        </Text>
        {year && (
          <Text style={[type.filter, { color: colors.muted, marginTop: 2 }]}>{year}</Text>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 8 },
  text: { flex: 1 },
});
