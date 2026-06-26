import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useMyReviews } from '@/api/useMyReviews';
import { useProfile } from '@/api/useProfile';
import { useAuth } from '@/lib/auth';
import { ReviewRow } from '@/components/ReviewRow';
import { ContentActionSheet } from '@/components/ContentActionSheet';
import { ReviewRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope } from '@/types';

// Another user's PUBLISHED reviews — the public twin of /profile/reviews. Same
// data hook (useMyReviews is generic: published-only via is_draft=false, and
// reviews are public-SELECT, so it reads any user by id), but READ-ONLY:
//   - no ⋯ edit/delete menu (omit onMenu → ReviewRow hides the affordance)
//   - drafts never appear (the hook filters them — see 0007)
// Reached from the "Reviews" row in their Profile › "{name}'s record".
export default function UserReviews() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: reviews, isLoading } = useMyReviews(id);
  const { data: profileData } = useProfile(id);
  const { user } = useAuth();
  // Every review on this page has the same author (the profile user `id`). Show a
  // ⋯ → Report/Block menu, except when you're looking at your OWN reviews via the
  // public route (edit/delete lives on /profile/reviews, not here).
  const isSelf = user?.id === id;
  const [menuReviewId, setMenuReviewId] = useState<string | null>(null);

  const profile = profileData?.profile;
  // Friendly name (display_name ?? username) for the row identity + header. No
  // email fallback here — this isn't the signed-in user, so we only have what
  // their public profile exposes.
  const username = profile?.username ?? 'user';
  const name = profile?.display_name ?? username;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        {/* Possessive title mirrors the "{name}'s record" profile header.
            numberOfLines guards a long name from colliding with the back arrow. */}
        <Text style={[type.subhead, { color: colors.ink, flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          {profile ? `${name}'s reviews` : 'Reviews'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ReviewRowsSkeleton />
      ) : !reviews || reviews.length === 0 ? (
        <Text style={styles.empty}>No reviews yet.</Text>
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
              reviewId={r.id}
              tmdbShowId={r.tmdb_show_id}
              posterPath={r.posterPath}
              posterPressable
              onPress={() => router.push(`/review/${r.id}` as any)}
              // ⋯ → Report/Block (others' reviews only; never on your own page).
              onMenu={isSelf ? undefined : () => setMenuReviewId(r.id)}
            />
          ))}
        </ScrollView>
      )}

      {/* All rows share one author (the profile user) → one retargetable menu. */}
      <ContentActionSheet
        visible={!!menuReviewId}
        onClose={() => setMenuReviewId(null)}
        target={{ type: 'review', id: menuReviewId ?? '', userId: id }}
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
