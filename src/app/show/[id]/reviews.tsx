// /show/[id]/reviews — the Reviews tab: every review for the show, newest first.
// (The big hero + your rating card live on the Overview landing; this tab uses the
// compact header like Seasons/Lists.) Reads via usePopularReviews (get-reviews).
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useShowLists } from '@/api/useShowLists';
import { useDeleteReview } from '@/api/useReviewMutations';
import { useProfile } from '@/api/useProfile';
import { useAuth } from '@/lib/auth';
import { Tabs } from '@/components/Tabs';
import { ReviewRow } from '@/components/ReviewRow';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { ShowCompactHeader } from '@/components/ShowCompactHeader';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope, resolveScope, buildScopeArt, type GetReviewsResponse, type TmdbSeason } from '@/types';

type ReviewItem = GetReviewsResponse['reviews'][number];

export default function ShowReviews() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const { data: showLists } = useShowLists(tmdbShowId); // real Lists badge
  const { user } = useAuth();
  const { data: myProfile } = useProfile(user?.id);
  const myDisplayName = myProfile?.profile?.display_name ?? null;
  const { remove } = useDeleteReview();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuReview, setMenuReview] = useState<ReviewItem | null>(null);

  const reviews = reviewsData?.reviews ?? [];

  const confirmDeleteReview = (reviewId: string) => {
    Alert.alert('Delete review?', 'This permanently deletes your review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(reviewId, tmdbShowId);
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  // A scope-art-bearing card from the catalog we already hold, so each review row
  // can resolve its season/episode poster (resolveScope) — no extra fetch.
  const showCard = data
    ? {
        tmdb_show_id: tmdbShowId,
        name: data.catalog.name,
        poster_path: data.catalog.poster_path ?? null,
        backdrop_path: data.catalog.backdrop_path ?? null,
        scopeArt: buildScopeArt(data.catalog),
      }
    : undefined;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow status={showScopeStatus} onCheckPress={() => setSheetOpen(true)} />

      {isLoading && <ActivityIndicator style={styles.center} color={colors.ink} />}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load show.</Text>}

      {data && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <ShowCompactHeader
            name={data.catalog.name}
            rating={data.catalog.vote_average}
            seasonsCount={seasons.length}
            episodesCount={seasons.reduce((sum, s) => sum + (s.episodes?.length ?? 0), 0)}
            posterPath={data.catalog.poster_path}
            tmdbShowId={tmdbShowId}
          />

          <Tabs
            showId={tmdbShowId}
            active="reviews"
            counts={{
              reviews: reviews.length,
              seasons: seasons.length,
              lists: showLists?.length,
            }}
          />

          <View style={styles.subhead}>
            {/* Honest label: every review, newest first — not a ranked "popular"
                set, and there's no see-all/filter yet, so no › / ⌄ affordance. */}
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
                // Your own reviews use your live profile display name (instant on edit).
                displayName={r.user_id === user?.id ? (myDisplayName ?? r.display_name) : r.display_name}
                avatarUri={r.avatar_url ?? undefined}
                showTitle={data.catalog.name}
                seasonLine={formatScope(r.season_number, r.episode_number)}
                rating={r.rating ?? 0}
                body={r.body}
                containsSpoilers={r.contains_spoilers}
                likes={r.likes}
                tmdbShowId={tmdbShowId}
                posterPath={resolveScope(
                  { tmdb_show_id: tmdbShowId, season_number: r.season_number, episode_number: r.episode_number },
                  showCard,
                ).posterPath}
                onPress={() => router.push(`/review/${r.id}` as any)}
                onMenu={user && r.user_id === user.id ? () => setMenuReview(r) : undefined}
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

      {/* Owner-only Edit/Delete for the tapped review. Edit reuses the composer
          (review.tsx?reviewId=) with the scope locked. */}
      <ActionMenuSheet
        visible={!!menuReview}
        onClose={() => setMenuReview(null)}
        actions={
          menuReview
            ? [
                {
                  label: 'Edit review',
                  onPress: () =>
                    router.push(`/show/${tmdbShowId}/review?reviewId=${menuReview.id}` as any),
                },
                {
                  label: 'Delete review',
                  destructive: true,
                  onPress: () => confirmDeleteReview(menuReview.id),
                },
              ]
            : []
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  subhead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: pad, paddingTop: 16, paddingBottom: 12,
  },
  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },
});
