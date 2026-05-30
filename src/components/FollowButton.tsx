import { Pressable, Text, StyleSheet } from 'react-native';
import { useFollow } from '@/api/useFollow';
import { colors, fonts, radius } from '@/theme';

// Compact pill (not the full-width Button). Follow = filled ink / white text;
// Following = outlined (white fill, hairline border, ink text) — the secondary-
// button style per spec. Tap → toggle() (gates auth + optimistic).
export function FollowButton({ followeeId }: { followeeId: string }) {
  const { isFollowing, toggle, isPending } = useFollow(followeeId);
  return (
    <Pressable
      onPress={toggle}
      disabled={isPending}
      hitSlop={6}
      style={[styles.pill, isFollowing ? styles.following : styles.follow]}
    >
      <Text style={[styles.label, { color: isFollowing ? colors.ink : colors.white }]}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  follow: { backgroundColor: colors.ink },
  following: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.hairline },
  label: { fontFamily: fonts.semibold, fontSize: 14 },
});
