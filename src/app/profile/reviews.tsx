import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useMyReviews } from '@/api/useMyReviews';
import { useProfile } from '@/api/useProfile';
import { ReviewRow } from '@/components/ReviewRow';
import { ReviewRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon } from '@/components/icons';
import { colors, type, pad } from '@/theme';
import { formatScope } from '@/types';

// Reviews = the signed-in user's own posted reviews, newest first. The "Reviews"
// row in Profile › Your record. Reuses ReviewRow (same component the show screen
// uses); the author is always you, so we pass your profile identity to every
// row. Read-only here — edit/delete lives on the show's review screen (the
// canonical place to manage a review). Posters tap through to each show.
export default function MyReviews() {
  const { user } = useAuth();
  const { data: reviews, isLoading } = useMyReviews(user?.id);
  const { data: myProfile } = useProfile(user?.id);

  const profile = myProfile?.profile;
  const username = profile?.username ?? user?.email?.split('@')[0] ?? 'you';

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
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
