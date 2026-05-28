import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { Poster } from '@/components/Poster';
import { StatRow } from '@/components/StatRow';
import { Tabs } from '@/components/Tabs';
import { ReviewRow } from '@/components/ReviewRow';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { UserRatingCard } from '@/components/UserRatingCard';
import { colors, type, pad, fonts } from '@/theme';

// TODO(phase-future): replace with a `usePopularReviews(showId)` hook.
const MOCK_REVIEWS = [
  {
    username: 'maya',
    showTitle: 'The Bear',
    seasonLine: 'Season 2 · Forks',
    rating: 4.5,
    body: 'episode 7 is one of the best things ive ever seen on tv. just perfect.',
    likes: 127,
  },
  {
    username: 'jordan',
    showTitle: 'The Bear',
    seasonLine: 'Season 1',
    rating: 4.0,
    body: 'the kitchen feels real. carmy is a mess in the best way.',
    likes: 84,
  },
];

export default function ShowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Show-scope status + rating (both nullable). Drive nav-row state, card, sheet.
  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  // "Has any user interaction" — purple bubble lights up for either signal.
  const engaged = showScopeStatus !== null || showScopeRating !== null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow
        watchedPct={0}
        engaged={engaged}
        onCheckPress={() => {
          console.log('[ShowDetail] opening action sheet');
          setSheetOpen(true);
        }}
      />

      {isLoading && <ActivityIndicator style={styles.center} color={colors.ink} />}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load show.</Text>}

      {data && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.heroWrap}>
            <Poster
              tmdbShowId={tmdbShowId}
              posterPath={data.catalog.poster_path}
              name={data.catalog.name}
              width={152}
              pressable={false}
            />
          </View>

          <View style={styles.kickerRow}>
            {data.catalog.genres?.[0] && (
              <Text style={[type.kicker, { color: colors.faint, letterSpacing: 0.5 }]}>
                {data.catalog.genres[0].name.toUpperCase()} ·{' '}
              </Text>
            )}
            <Text style={[type.freshTag, { color: colors.green, letterSpacing: 0.5 }]}>FRESH</Text>
          </View>

          <Text
            style={[
              type.screenTitle,
              { color: colors.ink, textAlign: 'center', marginTop: 6, paddingHorizontal: pad },
            ]}
          >
            {data.catalog.name.toUpperCase()}
          </Text>

          {data.catalog.created_by?.[0] && (
            <Text
              style={[type.creator, { color: colors.muted, textAlign: 'center', marginTop: 6 }]}
            >
              {data.catalog.created_by[0].name}
            </Text>
          )}

          <View style={styles.statWrap}>
            <StatRow
              rating={data.catalog.vote_average}
              viewers={data.catalog.vote_count}
              popularity={Math.round((data.catalog as { popularity?: number }).popularity ?? 0)}
            />
          </View>

          {/* Letterboxd-style personal-rating card. Self-hides when rating is 0/null. */}
          <UserRatingCard
            rating={showScopeRating ?? 0}
            onPress={() => setSheetOpen(true)}
          />

          <Tabs
            showId={tmdbShowId}
            active="reviews"
            counts={{
              reviews: MOCK_REVIEWS.length,
              seasons: data.catalog.seasons?.length,
              lists: 0,
            }}
          />

          <View style={styles.subhead}>
            <Text style={[type.subhead, { color: colors.ink }]}>Popular Reviews ›</Text>
            <Text style={[type.filter, { color: colors.muted }]}>Everyone ⌄</Text>
          </View>

          {MOCK_REVIEWS.map((r, i) => (
            <ReviewRow
              key={i}
              {...r}
              tmdbShowId={tmdbShowId}
              posterPath={data.catalog.poster_path}
            />
          ))}
        </ScrollView>
      )}

      <BottomNav active="home" />

      <ShowActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tmdbShowId={tmdbShowId}
        currentStatus={showScopeStatus}
        currentRating={showScopeRating}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  heroWrap: { alignItems: 'center', marginTop: 16 },
  kickerRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  statWrap: { marginTop: 20, marginBottom: 16 },
  subhead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: pad, paddingTop: 16, paddingBottom: 12,
  },
  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },
});
