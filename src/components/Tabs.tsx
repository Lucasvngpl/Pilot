import { View, Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export type TabKey = 'reviews' | 'overview' | 'seasons' | 'lists';

type Props = {
  showId: number | string;
  active: TabKey;
  counts: Partial<Record<TabKey, number>>;
};

// Each tab is a route — Reviews is the index, the rest live at /show/[id]/<tab>.
// Tabs REPLACE (not push) so switching between them doesn't stack onto the
// back-history (you'd otherwise "swipe back" through tabs) — same treatment as the
// bottom nav. Paired with `animation: 'none'` on these routes (see _layout) so a
// tab tap swaps content instantly instead of sliding like a page turn.
// Order = info-first: Overview is the landing (the index route), then Seasons
// (Pilot's episode-tracking core), then the social tabs Reviews + Lists.
const TABS: { key: TabKey; label: string; route: (id: string) => string }[] = [
  { key: 'overview', label: 'Overview', route: (id) => `/show/${id}` },
  { key: 'seasons',  label: 'Seasons',  route: (id) => `/show/${id}/seasons` },
  { key: 'reviews',  label: 'Reviews',  route: (id) => `/show/${id}/reviews` },
  { key: 'lists',    label: 'Lists',    route: (id) => `/show/${id}/lists` },
];

export function Tabs({ showId, active, counts }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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
              onPress={() => {
                if (isActive) return; // already here — no-op (avoids a self-replace)
                router.replace(route(String(showId)) as any);
              }}
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

const makeStyles = (colors: Palette) => StyleSheet.create({
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
