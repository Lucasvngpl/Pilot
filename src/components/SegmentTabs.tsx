import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export type SegmentTab<K extends string> = { key: K; label: string };

type Props<K extends string> = {
  tabs: SegmentTab<K>[];
  active: K;
  onChange: (key: K) => void;
  counts?: Partial<Record<K, number>>;
};

// Generic in-place tab row — horizontal scroll, active underline, optional count
// chip. Switches content via onChange; it does NOT navigate. Shared by the
// Profile sub-tabs and the Search sub-tabs (styling matches components/Tabs.tsx).
export function SegmentTabs<K extends string>({ tabs, active, onChange, counts }: Props<K>) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {tabs.map(({ key, label }) => {
          const isActive = key === active;
          const count = counts?.[key];
          return (
            <Pressable key={key} style={styles.tab} onPress={() => onChange(key)}>
              <Text
                style={[
                  isActive ? type.tabActive : type.tabInactive,
                  { color: isActive ? colors.ink : colors.muted },
                ]}
              >
                {label}
              </Text>
              {typeof count === 'number' && (
                <View
                  style={[styles.chip, { backgroundColor: isActive ? colors.purple : colors.hairline }]}
                >
                  <Text style={[type.chipText, { color: isActive ? colors.white : colors.muted }]}>
                    {count}
                  </Text>
                </View>
              )}
              {isActive && <View style={styles.underline} />}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.hairline} />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 22, paddingHorizontal: pad, paddingBottom: 10 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
    paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 18,
    alignItems: 'center',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.ink,
  },
  hairline: { height: 1, backgroundColor: colors.hairline },
});
