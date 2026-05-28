import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Stars } from '@/components/Stars';
import { colors, fonts, pad } from '@/theme';

type Props = {
  rating: number;        // 0..5, half-step. 0 = hidden.
  onPress: () => void;
};

// Letterboxd-style "you've rated this" card. Self-hides when rating == 0
// so the caller passes `currentRating ?? 0` with no conditional wrapper.
// The whole card is the tap target — no decorative dots.
export function UserRatingCard({ rating, onPress }: Props) {
  if (!rating) return null;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Placeholder avatar — real user-avatar fetching comes with Profile. */}
      <View style={styles.avatar} />
      <Text style={styles.label}>You&apos;ve rated this show</Text>
      <View style={styles.spacer} />
      <Stars value={rating} size={14} color={colors.purple} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.field,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: pad,
    marginTop: 4,
    gap: 12,
  },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.hairline,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  spacer: { flex: 1 },
});
