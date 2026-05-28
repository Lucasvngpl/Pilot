import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, type, pad } from '@/theme';
import { StarIcon, CheckIcon } from '@/components/icons';

type Props = {
  number: number;
  title: string;
  runtimeMin?: number | null;
  rating?: number | null;
  watched: boolean;
  onToggle?: () => void;
};

export function EpisodeRow({ number, title, runtimeMin, rating, watched, onToggle }: Props) {
  return (
    <View style={styles.row}>
      <Text style={[type.epNum, { color: watched ? colors.ink : colors.faint, width: 24 }]}>
        {number}
      </Text>
      <View style={styles.body}>
        <Text style={[type.reviewTitle, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.sub}>
          {!!runtimeMin && (
            <Text style={[type.epRuntime, { color: colors.muted }]}>{runtimeMin}m</Text>
          )}
          {!!runtimeMin && !!rating && (
            <Text style={[type.epRuntime, { color: colors.muted }]}>{'  ·  '}</Text>
          )}
          {!!rating && (
            <>
              <StarIcon color={colors.gold} size={11} />
              <Text style={[type.epRating, { color: colors.muted, marginLeft: 3 }]}>
                {rating.toFixed(1)}
              </Text>
            </>
          )}
        </View>
      </View>
      <Pressable onPress={onToggle} hitSlop={10}>
        <View style={[styles.check, watched ? styles.on : styles.off]}>
          {watched && <CheckIcon color={colors.white} size={14} />}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: pad,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 12,
  },
  body: { flex: 1 },
  sub: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  check: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  on:  { backgroundColor: colors.purple },
  off: { borderWidth: 1.5, borderColor: colors.hairline },
});
