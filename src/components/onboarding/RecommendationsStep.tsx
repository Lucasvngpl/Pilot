// Onboarding step 2 — "Starter recommendations". A grid of trending shows the user
// can tap to add to their watchlist. Reuses useTrendingShows (the stable interface
// over get-popular / shows_cache), so when trending switches to app-activity ranking
// later this step upgrades for free. Selection lives in the onboarding context and is
// flushed via bulk_add_watchlist on sign-in.
import { View, Text, Pressable, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useTrendingShows } from '@/api/useTrendingShows';
import { useOnboarding } from '@/lib/onboarding';
import { Poster } from '@/components/Poster';
import { AddIndicator } from '@/components/AddIndicator';
import { PosterGridSkeleton } from '@/components/Skeletons';
import { fonts, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

const COLS = 3;
const GAP = 12;

export function RecommendationsStep() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { watchlist, toggleWatchlist } = useOnboarding();
  const { width } = useWindowDimensions();
  const slotW = Math.floor((width - pad * 2 - GAP * (COLS - 1)) / COLS);

  const { data: shows, isLoading } = useTrendingShows(18);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Shows to get you started</Text>
        <Text style={styles.subtitle}>
          Popular right now. Tap any you want to watch — we&apos;ll add them to your watchlist
          {watchlist.size > 0 ? ` (${watchlist.size})` : ''}.
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.grid}>
        {isLoading ? (
          <PosterGridSkeleton />
        ) : (
          (shows ?? []).map((s) => {
            const on = watchlist.has(s.tmdb_show_id);
            return (
              <Pressable
                key={s.tmdb_show_id}
                onPress={() => toggleWatchlist(s.tmdb_show_id)}
                style={{ width: slotW }}
              >
                {/* pressable=false so the tap toggles selection instead of routing
                    into the show. The overlay marks the chosen state. */}
                <Poster
                  tmdbShowId={s.tmdb_show_id}
                  posterPath={s.poster_path}
                  name={s.name}
                  width={slotW}
                  pressable={false}
                />
                {/* Dim + check the chosen posters so the grid reads at a glance. */}
                {on && <View style={[styles.selectedScrim, { width: slotW, height: slotW * 1.5 }]} />}
                <View style={styles.indicator}>
                  <AddIndicator added={on} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { paddingHorizontal: pad, paddingTop: 4, paddingBottom: 12 },
    title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
    subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 21 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GAP,
      paddingHorizontal: pad,
      paddingTop: 8,
      paddingBottom: 24,
    },
    // Semi-transparent ink wash over a selected poster (scrim token = the dim used
    // behind sheets; reads correctly in both themes).
    selectedScrim: {
      position: 'absolute',
      top: 0,
      left: 0,
      borderRadius: 6,
      backgroundColor: colors.scrim,
    },
    indicator: { position: 'absolute', top: 6, right: 6 },
  });
