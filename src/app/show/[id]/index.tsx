// /show/[id] — show detail: hero poster, metadata, community stats, the signed-in user's rating card, and the reviews list.
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
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
import { ShowDetailSkeleton } from '@/components/ShowDetailSkeleton';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope, type GetReviewsResponse } from '@/types';

type ReviewItem = GetReviewsResponse['reviews'][number];

export default function ShowDetail() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const { user } = useAuth();
  const { data: myProfile } = useProfile(user?.id); // cached from the Profile screen
  const myAvatar = myProfile?.profile?.avatar_url ?? null;
  const myDisplayName = myProfile?.profile?.display_name ?? null;
  const { remove } = useDeleteReview();
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
            await remove(reviewId, tmdbShowId);
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

  // --- Catalog meta (all from the cached /tv payload — no backend call) ---
  const c = data?.catalog;
  // `[year · N Seasons · Status]`. filter(Boolean) drops any part TMDb omitted,
  // so a show with no air date or season count just shows fewer segments.
  const metaParts = [
    c?.first_air_date?.slice(0, 4),
    c?.number_of_seasons ?? c?.seasons?.length
      ? `${c?.number_of_seasons ?? c?.seasons?.length} Season${(c?.number_of_seasons ?? c?.seasons?.length) === 1 ? '' : 's'}`
      : null,
    prettyStatus(c?.status),
  ].filter(Boolean) as string[];
  const networks = (c?.networks ?? []).slice(0, 2); // HBO etc. — rarely more than 1–2
  const nextAir = formatAirDate(c?.next_episode_to_air?.air_date);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow
        status={showScopeStatus}
        onCheckPress={() => setSheetOpen(true)}
      />

      {isLoading && <ShowDetailSkeleton />}
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

          {/* Meta line: year · seasons · status. Centered to match the hero. */}
          {metaParts.length > 0 && (
            <Text style={[styles.meta, { color: colors.muted }]}>
              {metaParts.join('  ·  ')}
            </Text>
          )}

          {/* Tagline — the show's one-liner. Synthetic italic (no italic font
              in the theme) is fine for one short, low-emphasis line. */}
          {data.catalog.tagline ? (
            <Text style={[styles.tagline, { color: colors.faint }]}>
              &ldquo;{data.catalog.tagline}&rdquo;
            </Text>
          ) : null}

          {/* Network(s) = the broadcaster (HBO). NOT "where to stream" — that's
              watch/providers, a separate change with JustWatch attribution. Names
              (not logos) so light-on-transparent logos stay legible on white. */}
          {networks.length > 0 && (
            <View style={styles.networkRow}>
              {networks.map((n) => (
                <View key={n.id} style={styles.networkPill}>
                  <Text style={styles.networkPillText}>{n.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Only when TMDb has a scheduled next air date (ongoing shows). */}
          {nextAir && (
            <Text style={[styles.nextEp, { color: colors.green }]}>New episode {nextAir}</Text>
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

// TMDb's lifecycle strings → short human labels. Returns null for unknown/empty
// so it drops out of the meta line rather than printing a raw API value.
function prettyStatus(status?: string): string | null {
  switch (status) {
    case 'Returning Series': return 'Returning';
    case 'Ended': return 'Ended';
    case 'Canceled': return 'Canceled';
    case 'In Production': return 'In production';
    case 'Planned': return 'Upcoming';
    case 'Pilot': return 'Pilot';
    default: return status ?? null;
  }
}

// "2026-05-31" → "May 31". Parse the parts by hand instead of `new Date(iso)`:
// that reads the string as UTC midnight, which renders as the *previous* day in
// any negative-offset timezone (US) — a classic off-by-one on bare dates.
function formatAirDate(iso?: string): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${MONTHS[m - 1]} ${d}`;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heroWrap: { alignItems: 'center', marginTop: 16 },
  meta: { fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: 10 },
  tagline: {
    fontFamily: fonts.regular, fontSize: 14, fontStyle: 'italic',
    textAlign: 'center', marginTop: 8, paddingHorizontal: pad,
  },
  networkRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  networkPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.sm, backgroundColor: colors.field,
  },
  networkPillText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  nextEp: { fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center', marginTop: 10 },
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
