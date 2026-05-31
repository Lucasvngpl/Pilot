import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useDeleteReview } from '@/api/useReviewMutations';
import { useProfile } from '@/api/useProfile';
import { useAuth } from '@/lib/auth';
import { Poster } from '@/components/Poster';
import { StatRow } from '@/components/StatRow';
import { Tabs } from '@/components/Tabs';
import { ReviewRow } from '@/components/ReviewRow';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { UserRatingCard } from '@/components/UserRatingCard';
import { colors, type, pad, fonts } from '@/theme';
import { formatScope, type GetReviewsResponse } from '@/types';

type ReviewItem = GetReviewsResponse['reviews'][number];

export default function ShowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const { user } = useAuth();
  const { data: myProfile } = useProfile(user?.id); // cached from the Profile screen
  const myAvatar = myProfile?.profile?.avatar_url ?? null;
  const myDisplayName = myProfile?.profile?.display_name ?? null;
  const { remove } = useDeleteReview(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The own-review whose ⋯ menu is open (null = closed).
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
            await remove(reviewId);
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  // Show-scope status + rating (both nullable). Drive nav-row state, card, sheet.
  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow
        status={showScopeStatus}
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
              viewerAvatars={[
                // You don't follow yourself, so stats.viewerAvatars never includes
                // you — prepend your own face when you're a viewer (have any
                // watch_status here), else you'd see a grey circle as the lone viewer.
                ...(data.mySocial.watch_statuses.length > 0 && myAvatar ? [myAvatar] : []),
                ...(data.stats?.viewerAvatars ?? []).map((v) => v.avatar_url),
              ]}
              onViewersPress={() => router.push(`/show/${tmdbShowId}/viewers` as any)}
              popularity={Math.round((data.catalog as { popularity?: number }).popularity ?? 0)}
            />
          </View>

          <UserRatingCard rating={showScopeRating ?? 0} avatarUrl={myAvatar} onPress={() => setSheetOpen(true)} />

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
                // Your own reviews use your live profile display name (instant on
                // edit). Others' come from get-reviews (display_name once it's
                // redeployed — until then null → falls back to the @handle).
                displayName={r.user_id === user?.id ? (myDisplayName ?? r.display_name) : r.display_name}
                avatarUri={r.avatar_url ?? undefined}
                showTitle={data.catalog.name}
                seasonLine={formatScope(r.season_number, r.episode_number)}
                rating={r.rating ?? 0}
                body={r.body}
                containsSpoilers={r.contains_spoilers}
                likes={r.likes}
                tmdbShowId={tmdbShowId}
                posterPath={data.catalog.poster_path}
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

      {/* Owner-only Edit/Delete menu for the tapped review. */}
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
