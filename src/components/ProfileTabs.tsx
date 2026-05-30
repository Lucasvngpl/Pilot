import { ScrollView, View, Pressable, Text, StyleSheet } from 'react-native';
import { colors, type, pad } from '@/theme';

export type ProfileTabKey = 'profile' | 'shows' | 'lists' | 'watchlist';

const TABS: { key: ProfileTabKey; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'shows', label: 'Shows' },
  { key: 'lists', label: 'Lists' },
  { key: 'watchlist', label: 'Watchlist' },
];

type Props = {
  active: ProfileTabKey;
  onChange: (key: ProfileTabKey) => void;
  counts?: Partial<Record<ProfileTabKey, number>>;
};

// Profile sub-tabs. Unlike components/Tabs.tsx (which navigates to /show/[id]
// routes), these switch content IN PLACE via onChange — there are no separate
// routes for the profile sections. Styling (underline, count chip) mirrors Tabs
// so the two tab rows feel like the same system.
export function ProfileTabs({ active, onChange, counts }: Props) {
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {TABS.map(({ key, label }) => {
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

const styles = StyleSheet.create({
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
