import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
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

// Diary = a date-grouped log of every watched event (whole-show / season /
// episode), newest first. Letterboxd-style rows (date cell · poster · title +
// year · scope · stars + review marker), in Pilot's light theme. Own-only (the
// Profile "Diary" link is gated to the signed-in user).
export default function Diary() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: sections, isLoading } = useDiary(user?.id);

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
      ) : !sections || sections.length === 0 ? (
        <Text style={styles.empty}>Your diary is empty — nothing watched yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {sections.map((s) => (
            <View key={s.month}>
              <View style={styles.monthBand}>
                <Text style={styles.monthText}>{s.month}</Text>
              </View>
              {s.entries.map((e) => (
                <DiaryRow key={e.key} entry={e} />
              ))}
            </View>
          ))}
        </ScrollView>
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
