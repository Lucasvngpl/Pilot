import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Poster } from '@/components/Poster';
import { Stars } from '@/components/Stars';
import { ReviewBadgeIcon } from '@/components/icons';
import { colors, type, pad } from '@/theme';

const GAP = 10;
const COLS = 4;

export type GridItem = {
  tmdb_show_id: number;
  name: string;
  poster_path: string | null;
  rating?: number | null; // show a gold half-star overlay when present
  hasReview?: boolean;     // show the review marker when true
};

// 4-column poster grid powering both the Shows and Watchlist tabs. Tapping a
// poster routes to /show/[id] (Poster handles that itself). The meta row under a
// tile only renders when there's something to show, so a bare watchlist grid
// stays clean.
export function PosterGrid({ items, emptyText }: { items: GridItem[]; emptyText: string }) {
  const { width: screenW } = useWindowDimensions();
  // Divide the content width (screen minus side padding) into COLS tiles + gaps.
  const tileW = Math.floor((screenW - pad * 2 - GAP * (COLS - 1)) / COLS);

  if (items.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.grid}>
      {items.map((it) => {
        const showMeta = it.rating != null || it.hasReview;
        return (
          <View key={it.tmdb_show_id} style={{ width: tileW }}>
            <Poster
              tmdbShowId={it.tmdb_show_id}
              posterPath={it.poster_path}
              name={it.name}
              width={tileW}
            />
            {showMeta && (
              <View style={styles.meta}>
                {it.rating != null ? (
                  <Stars value={it.rating} size={10} color={colors.gold} />
                ) : (
                  <View />
                )}
                {it.hasReview && <ReviewBadgeIcon color={colors.muted} size={12} />}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // `gap` spaces tiles both across (column gap) and between wrapped rows.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: pad,
    paddingTop: 12,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
    minHeight: 14,
  },
  empty: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingHorizontal: pad,
    paddingVertical: 28,
    textAlign: 'center',
  },
});
