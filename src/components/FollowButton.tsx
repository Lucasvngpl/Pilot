import { Pressable, Text, StyleSheet } from 'react-native';
import { useFollow } from '@/api/useFollow';
import { fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// Compact pill (not the full-width Button). Follow = ink fill / inverted label;
// Following = outlined (surface fill, hairline border, ink text) — the secondary-
// button style per spec. The "Follow" label tracks `background` (not fixed white)
// so it stays legible after the ink fill inverts to light in dark mode.
// Tap → toggle() (gates auth + optimistic).
export function FollowButton({ followeeId }: { followeeId: string }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { isFollowing, toggle, isPending } = useFollow(followeeId);
  return (
    <Pressable
      onPress={toggle}
      disabled={isPending}
      hitSlop={6}
      style={[styles.pill, isFollowing ? styles.following : styles.follow]}
    >
      <Text style={[styles.label, { color: isFollowing ? colors.ink : colors.background }]}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  pill: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  follow: { backgroundColor: colors.ink },
  following: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  label: { fontFamily: fonts.semibold, fontSize: 14 },
});
