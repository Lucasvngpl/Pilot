import { View, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, pad } from '@/theme';
import { ChevronLeftIcon, CheckIcon, PlayIcon, ClockIcon, DotsIcon } from '@/components/icons';
import type { WatchStatus } from '@/types';

// Shared nav row at the top of every show-scoped screen (Show Detail, Seasons).
// The bubble opens the ShowActionSheet AND mirrors the show-scope status: a
// checkmark ONLY means "watched" — "watching" shows a play glyph, "watchlist" a
// clock — so the icon never claims you watched something you merely saved for
// later. The bubble is purple whenever a status is set; tapping always opens the
// sheet regardless of state.
const STATUS_ICON: Record<WatchStatus, React.ComponentType<{ color?: string; size?: number }>> = {
  watched: CheckIcon,
  watching: PlayIcon,
  watchlist: ClockIcon,
};

export function ShowNavRow({
  status, onCheckPress,
}: {
  status: WatchStatus | null;
  onCheckPress: () => void;
}) {
  const active = status !== null;
  // No status yet → a neutral check outline as the "set a status" affordance.
  const Icon = status ? STATUS_ICON[status] : CheckIcon;

  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <ChevronLeftIcon color={colors.ink} size={24} />
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onCheckPress}
        hitSlop={8}
        style={[styles.bubble, active ? styles.bubbleActive : styles.bubbleInactive]}
      >
        <Icon color={active ? colors.white : colors.ink} size={14} />
      </Pressable>

      <View style={{ width: 12 }} />

      <Pressable hitSlop={8}><DotsIcon color={colors.ink} size={18} /></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  bubble: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleActive:   { backgroundColor: colors.purple },
  bubbleInactive: { backgroundColor: colors.field },
});
