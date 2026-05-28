import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, type, pad } from '@/theme';
import { ChevronLeftIcon, CheckIcon, DotsIcon } from '@/components/icons';

// Shared nav row used at the top of every show-scoped screen (Show Detail,
// Seasons, eventually Overview / Lists). The check-icon bubble opens the
// ShowActionSheet on tap. `engaged` is the visual-state flag — purple when
// the user has any interaction with this show (status today, rating today,
// reviews later). Tapping always opens the sheet regardless of state.
export function ShowNavRow({
  watchedPct, engaged, onCheckPress,
}: {
  watchedPct: number;
  engaged: boolean;
  onCheckPress: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <ChevronLeftIcon color={colors.ink} size={24} />
      </Pressable>

      <View style={{ flex: 1 }} />

      <Text style={[type.filter, { color: colors.faint, marginRight: 12 }]}>
        {watchedPct}% watched
      </Text>

      <Pressable
        onPress={() => {
          console.log('[ShowNavRow] check tapped, engaged:', engaged);
          onCheckPress();
        }}
        hitSlop={8}
        style={[styles.bubble, engaged ? styles.bubbleActive : styles.bubbleInactive]}
      >
        <CheckIcon color={engaged ? colors.white : colors.ink} size={14} />
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
