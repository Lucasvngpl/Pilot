import { View, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, type, pad } from '@/theme';

export type TabKey = 'reviews' | 'overview' | 'seasons' | 'lists';

type Props = {
  showId: number | string;
  active: TabKey;
  counts: Partial<Record<TabKey, number>>;
};

// Each tab pushes a route — Reviews is the index, the rest live at /show/[id]/<tab>.
// (Overview / Lists aren't built yet; pushing them will 404 until then.)
const TABS: { key: TabKey; label: string; route: (id: string) => string }[] = [
  { key: 'reviews',  label: 'Reviews',  route: (id) => `/show/${id}` },
  { key: 'overview', label: 'Overview', route: (id) => `/show/${id}/overview` },
  { key: 'seasons',  label: 'Seasons',  route: (id) => `/show/${id}/seasons` },
  { key: 'lists',    label: 'Lists',    route: (id) => `/show/${id}/lists` },
];

export function Tabs({ showId, active, counts }: Props) {
  return (
    <View>
      <View style={styles.row}>
        {TABS.map(({ key, label, route }) => {
          const isActive = key === active;
          const count = counts[key];
          return (
            <Pressable
              key={key}
              style={styles.tab}
              onPress={() => router.push(route(String(showId)) as any)}
            >
              <Text style={[
                isActive ? type.tabActive : type.tabInactive,
                { color: isActive ? colors.ink : colors.muted },
              ]}>{label}</Text>
              {typeof count === 'number' && (
                <View style={[
                  styles.chip,
                  { backgroundColor: isActive ? colors.purple : colors.hairline },
                ]}>
                  <Text style={[type.chipText, { color: isActive ? colors.white : colors.muted }]}>
                    {count}
                  </Text>
                </View>
              )}
              {isActive && <View style={styles.underline} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hairline} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 22, paddingHorizontal: pad, paddingBottom: 10 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    position: 'relative', paddingVertical: 8,
  },
  chip: {
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
    minWidth: 18, alignItems: 'center',
  },
  // Underline absolutely positioned at the tab's bottom — sits ON the hairline,
  // visually replacing it just under the active tab.
  underline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: colors.ink,
  },
  hairline: { height: 1, backgroundColor: colors.hairline },
});
