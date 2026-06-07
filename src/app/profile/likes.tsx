// /profile/likes — the signed-in user's OWN-ONLY record of what they've liked:
// reviews + lists, newest-first by when they liked it. Reached only from your own
// profile's "My record" (never /user/[id]); mirrors /profile/drafts.
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useMyLikes } from '@/api/useMyLikes';
import { ReviewRow } from '@/components/ReviewRow';
import { ListCard } from '@/components/ListCard';
import { ReviewRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function Likes() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: likes, isLoading } = useMyLikes(user?.id);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Likes</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ReviewRowsSkeleton />
      ) : !likes || likes.length === 0 ? (
        <Text style={styles.empty}>You haven&apos;t liked anything yet.</Text>
      ) : (
        // One time-ordered stream, each entry rendered by its kind: a liked review
        // as a ReviewRow (carries the REVIEWER's identity, not yours), a liked list
        // as a ListCard. Tapping a review opens it; the ListCard routes itself.
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {likes.map((entry) =>
            entry.kind === 'review' ? (
              <ReviewRow
                key={`r:${entry.review.reviewId}`}
                username={entry.review.reviewerUsername}
                displayName={entry.review.reviewerDisplayName}
                avatarUri={entry.review.reviewerAvatarUrl ?? undefined}
                showTitle={entry.review.showName}
                seasonLine={entry.review.seasonLabel}
                rating={entry.review.rating}
                body={entry.review.body}
                containsSpoilers={entry.review.containsSpoilers}
                likes={entry.review.likes}
                reviewId={entry.review.reviewId}
                tmdbShowId={entry.review.tmdb_show_id}
                posterPath={entry.review.posterPath}
                posterPressable
                onPress={() => router.push(`/review/${entry.review.reviewId}` as any)}
              />
            ) : (
              <ListCard key={`l:${entry.list.id}`} list={entry.list} />
            ),
          )}
        </ScrollView>
      )}
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
