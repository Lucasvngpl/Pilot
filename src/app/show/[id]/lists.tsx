// /show/[id]/lists — the Lists tab: public Pilot lists that include this show.
// Pilot's own social data (direct RLS query via useShowLists — no Edge Function);
// only public lists surface (the no-leak filter lives in the hook). Rows reuse the
// shared ListCard, which already taps through to /list/[id].
import { ScrollView, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useShowLists } from '@/api/useShowLists';
import { Tabs } from '@/components/Tabs';
import { ListCard } from '@/components/ListCard';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { ShowCompactHeader } from '@/components/ShowCompactHeader';
import { ShowTabSkeleton, ListCardsSkeleton } from '@/components/Skeletons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';
import type { TmdbSeason } from '@/types';

export default function ShowLists() {
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { data: reviewsData } = usePopularReviews(tmdbShowId); // real Reviews badge
  const { data: lists, isLoading: listsLoading } = useShowLists(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow status={showScopeStatus} onCheckPress={() => setSheetOpen(true)} />

      {isLoading && <ShowTabSkeleton><ListCardsSkeleton /></ShowTabSkeleton>}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load show.</Text>}

      {data && (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <ShowCompactHeader
            name={data.catalog.name}
            rating={data.catalog.vote_average}
            seasonsCount={seasons.length}
            episodesCount={seasons.reduce((sum, s) => sum + (s.episodes?.length ?? 0), 0)}
            posterPath={data.catalog.poster_path}
            tmdbShowId={tmdbShowId}
          />

          <Tabs
            showId={tmdbShowId}
            active="lists"
            counts={{
              reviews: reviewsData?.reviews.length,
              seasons: seasons.length,
              lists: lists?.length,
            }}
          />

          {listsLoading ? (
            <ListCardsSkeleton />
          ) : (lists ?? []).length === 0 ? (
            // The common case at launch (zero users) — never a blank tab.
            <Text style={[styles.muted, styles.empty]}>No lists include this show yet.</Text>
          ) : (
            (lists ?? []).map((l) => <ListCard key={l.id} list={l} />)
          )}
        </ScrollView>
      )}

      <BottomNav active="home" />

      <ShowActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tmdbShowId={tmdbShowId}
        currentStatus={showScopeStatus}
        currentRating={showScopeRating}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { padding: pad, textAlign: 'center' },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  empty: { paddingHorizontal: pad, paddingVertical: 24, textAlign: 'center' },
});
