import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { Poster } from '@/components/Poster';
import { StatRow } from '@/components/StatRow';
import { Tabs } from '@/components/Tabs';
import { ReviewRow } from '@/components/ReviewRow';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { UserRatingCard } from '@/components/UserRatingCard';
import { colors, type, pad, fonts } from '@/theme';
import { formatScope } from '@/types';

export default function ShowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const reviews = reviewsData?.reviews ?? [];

  // Show-scope status + rating (both nullable). Drive nav-row state, card, sheet.
  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  const engaged = showScopeStatus !== null || showScopeRating !== null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow
        watchedPct={0}
        engaged={engaged}
        onCheckPress={() => setSheetOpen(true)}
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
            {/* `?.`: a cached get-show response can predate the `stats` field
                (dev fast-refresh, or an OTA update over a warm cache) — render
                "—" until it refetches rather than crashing. */}
            <StatRow
              rating={data.stats?.avgRating ?? null}
              viewers={data.stats?.viewers ?? 0}
              viewerAvatars={(data.stats?.viewerAvatars ?? []).map((v) => v.avatar_url)}
              onViewersPress={() => router.push(`/show/${tmdbShowId}/viewers` as any)}
              popularity={Math.round((data.catalog as { popularity?: number }).popularity ?? 0)}
            />
          </View>

          <UserRatingCard rating={showScopeRating ?? 0} onPress={() => setSheetOpen(true)} />

          <Tabs
            showId={tmdbShowId}
            active="reviews"
            counts={{
              reviews: reviews.length,
              seasons: data.catalog.seasons?.length,
              lists: 0,
            }}
          />

          <View style={styles.subhead}>
            {/* Honest label: this is every review, newest first — not a ranked
                "popular" set, and there's no see-all route or filter yet. Drop
                the › / ⌄ affordances rather than fake interactivity. */}
            <Text style={[type.subhead, { color: colors.ink }]}>Reviews</Text>
          </View>

          {reviews.length === 0 ? (
            <Text style={[styles.muted, { paddingHorizontal: pad, paddingVertical: 8 }]}>
              No reviews yet.
            </Text>
          ) : (
            reviews.map((r) => (
              <ReviewRow
                key={r.id}
                username={r.username}
                avatarUri={r.avatar_url ?? undefined}
                showTitle={data.catalog.name}
                seasonLine={formatScope(r.season_number, r.episode_number)}
                rating={r.rating ?? 0}
                body={r.body}
                containsSpoilers={r.contains_spoilers}
                likes={r.likes}
                tmdbShowId={tmdbShowId}
                posterPath={data.catalog.poster_path}
              />
            ))
          )}
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
