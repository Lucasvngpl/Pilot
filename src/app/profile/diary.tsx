import { useMemo } from 'react';
import { SectionList, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useDiary } from '@/api/useDiary';
import { Poster } from '@/components/Poster';
import { Stars } from '@/components/Stars';
import { ChevronLeftIcon, ReviewBadgeIcon } from '@/components/icons';
import { DiaryRowsSkeleton } from '@/components/Skeletons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { DiaryEntry } from '@/types';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

// Group flat entries (already newest-first across all loaded pages) into month
// bands. Consecutive same-month rows merge — and because the order is stable
// across page boundaries, a month split over two pages still forms one band.
// Split-parse watched_at ("YYYY-MM-DD") for the label — timezone-free.
function groupByMonth(entries: DiaryEntry[]): { title: string; data: DiaryEntry[] }[] {
  const out: { title: string; data: DiaryEntry[] }[] = [];
  for (const e of entries) {
    const [y, mo] = e.watchedAt.split('-').map(Number);
    const title = `${MONTHS[mo - 1]} ${y}`;
    const last = out[out.length - 1];
    if (last && last.title === title) last.data.push(e);
    else out.push({ title, data: [e] });
  }
  return out;
}

// Diary = a date-grouped log of every watched event (whole-show / season /
// episode), newest first. Letterboxd-style rows (date cell · poster · title +
// year · scope · stars + review marker). Own-only (the Profile "Diary" link is
// gated to the signed-in user). Virtualized + infinite-scroll so a long history
// stays smooth and your oldest entries are always reachable (no LIMIT cliff).
export default function Diary() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useDiary(user?.id);

  // Flatten loaded pages, then group into month bands for the SectionList.
  const entries = useMemo(() => data?.pages.flat() ?? [], [data]);
  const sections = useMemo(() => groupByMonth(entries), [entries]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Diary</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <DiaryRowsSkeleton />
      ) : sections.length === 0 ? (
        <Text style={styles.empty}>Your diary is empty — nothing watched yet.</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => e.key}
          renderItem={({ item }) => <DiaryRow entry={item} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.monthBand}>
              <Text style={styles.monthText}>{section.title}</Text>
            </View>
          )}
          // Headers scroll away with their section (the band isn't a sticky chrome).
          stickySectionHeadersEnabled={false}
          // Pull the next page as the user nears the bottom. The guard avoids
          // firing again while a page is already in flight or none remain.
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator color={colors.muted} style={{ paddingVertical: 20 }} /> : null
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

function DiaryRow({ entry }: { entry: DiaryEntry }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/show/${entry.tmdb_show_id}`)}>
      <View style={styles.dateCell}>
        <Text style={styles.dateNum}>{entry.day}</Text>
      </View>

      <Poster
        tmdbShowId={entry.tmdb_show_id}
        posterPath={entry.poster_path}
        name={entry.name}
        width={44}
        pressable={false}
      />

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[type.reviewTitle, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>
            {entry.name}
          </Text>
          {entry.year && (
            <Text style={[type.filter, { color: colors.faint, marginLeft: 6 }]} numberOfLines={1}>
              {entry.year}
            </Text>
          )}
        </View>

        {entry.scopeLabel && (
          <Text style={[type.filter, { color: colors.muted, marginTop: 1 }]}>{entry.scopeLabel}</Text>
        )}

        {/* Stars (this scope's rating) + a review marker — Pilot has no
            liked/rewatch concepts, so unlike Letterboxd we show only these. */}
        {(entry.rating != null || entry.hasReview) && (
          <View style={styles.metaRow}>
            {entry.rating != null && <Stars value={entry.rating} size={12} color={colors.gold} />}
            {entry.hasReview && <ReviewBadgeIcon color={colors.muted} size={13} />}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  empty: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 40,
  },

  monthBand: { backgroundColor: colors.field, paddingHorizontal: pad, paddingVertical: 8 },
  monthText: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, color: colors.muted },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  dateCell: {
    width: 40, height: 40, borderRadius: 6,
    borderWidth: 1, borderColor: colors.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  dateNum: { fontFamily: fonts.medium, fontSize: 16, color: colors.muted },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, minHeight: 14 },
});
