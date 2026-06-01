import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useMyReviews } from '@/api/useMyReviews';
import { useProfile } from '@/api/useProfile';
import { useDeleteReview } from '@/api/useReviewMutations';
import { ReviewRow } from '@/components/ReviewRow';
import { ReviewRowsSkeleton } from '@/components/Skeletons';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope, type MyReviewEntry } from '@/types';

// Reviews = the signed-in user's own posted reviews, newest first. The "Reviews"
// row in Profile › Your record. Reuses ReviewRow (same component the show screen
// uses); every review here is yours, so each row gets the ⋯ menu to edit (reuses
// the show's review composer, scope locked) or delete. Posters tap to each show.
export default function MyReviews() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: reviews, isLoading } = useMyReviews(user?.id);
  const { data: myProfile } = useProfile(user?.id);
  const { remove } = useDeleteReview();
  // The review whose ⋯ menu is open (null = closed).
  const [menuReview, setMenuReview] = useState<MyReviewEntry | null>(null);

  const profile = myProfile?.profile;
  const username = profile?.username ?? user?.email?.split('@')[0] ?? 'you';

  const confirmDelete = (entry: MyReviewEntry) => {
    Alert.alert('Delete review?', 'This permanently deletes your review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(entry.id, entry.tmdb_show_id);
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ReviewRowsSkeleton />
      ) : !reviews || reviews.length === 0 ? (
        <Text style={styles.empty}>You haven&apos;t written any reviews yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {reviews.map((r) => (
            <ReviewRow
              key={r.id}
              username={username}
              displayName={profile?.display_name}
              avatarUri={profile?.avatar_url ?? undefined}
              showTitle={r.showName}
              seasonLine={formatScope(r.season_number, r.episode_number)}
              rating={r.rating ?? 0}
              body={r.body}
              containsSpoilers={r.contains_spoilers}
              likes={r.likes}
              tmdbShowId={r.tmdb_show_id}
              posterPath={r.posterPath}
              posterPressable
              onPress={() => router.push(`/review/${r.id}` as any)}
              onMenu={() => setMenuReview(r)}
            />
          ))}
        </ScrollView>
      )}

      {/* Edit/Delete for the tapped review (all reviews here are yours). Edit
          reuses the show's review composer with the scope locked. */}
      <ActionMenuSheet
        visible={!!menuReview}
        onClose={() => setMenuReview(null)}
        actions={
          menuReview
            ? [
                {
                  label: 'Edit review',
                  onPress: () =>
                    router.push(`/show/${menuReview.tmdb_show_id}/review?reviewId=${menuReview.id}` as any),
                },
                {
                  label: 'Delete review',
                  destructive: true,
                  onPress: () => confirmDelete(menuReview),
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
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  empty: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 40,
  },
});
