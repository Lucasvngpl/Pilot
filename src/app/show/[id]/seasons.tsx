// /show/[id]/seasons — the Seasons TAB: a vertical list of season ROWS (poster ·
// "Season N" · N episodes · year · eye + •••). NO horizontal pills/dropdown — one
// row per season. Tapping a row BODY drills into that season's episode list
// (/show/[id]/season). The eye is a SEASON-scope watched toggle (set/clear one
// season-level status row), DISTINCT from the ••• sheet's "Mark all episodes
// watched" bulk action (one row per episode). Reuses resolveScope (poster/title/
// key), <ScopeActions> (the ••• sheet), and the existing watched mutations.
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useShowLists } from '@/api/useShowLists';
import { useSetWatchStatus } from '@/api/useSetWatchStatus';
import { Tabs } from '@/components/Tabs';
import { Poster } from '@/components/Poster';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { ShowCompactHeader } from '@/components/ShowCompactHeader';
import { ShowTabSkeleton, ListCardsSkeleton } from '@/components/Skeletons';
import { EyeIcon, DotsIcon } from '@/components/icons';
import { useScopeSheet } from '@/lib/scopeSheet';
import { resolveScope, buildScopeArt, type ShowCard, type TmdbSeason } from '@/types';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function Seasons() {
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  // Season eye → set 'watched' / clear at SEASON scope (toggle-off). Forks on
  // scope: this is the season path, not useToggleEpisodeWatched (episodes).
  const { setStatus, clearStatus } = useSetWatchStatus(tmdbShowId);
  const openScope = useScopeSheet(); // ••• / long-press a season → its ScopeActions
  // Real tab-count badges (cached, shared with the other tab screens).
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const { data: showLists } = useShowLists(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  // Which seasons have a season-scope `watched` row (season set, episode null) →
  // each eye's filled state. Across the list, the filled eyes read at a glance as
  // "seasons I've completed".
  const seasonWatched = new Set(
    (data?.mySocial.watch_statuses ?? [])
      .filter((r) => r.season_number != null && r.episode_number === null && r.status === 'watched')
      .map((r) => r.season_number),
  );

  // Show-scope status + rating — feed the nav check + the show ••• ShowActionSheet.
  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  // A card carrying per-scope art so resolveScope returns each season's OWN poster.
  // resolveScope is the SOLE source of the season poster/title/key — it already
  // falls back up the hierarchy (season poster → show poster), so no ad-hoc
  // show-poster fallback is baked in here.
  const showCard: ShowCard | undefined = data
    ? {
        tmdb_show_id: tmdbShowId,
        name: data.catalog.name,
        poster_path: data.catalog.poster_path ?? null,
        scopeArt: buildScopeArt(data.catalog),
      }
    : undefined;

  const onToggleSeason = (seasonNumber: number, watched: boolean) =>
    watched
      ? clearStatus({ season_number: seasonNumber })
      : setStatus('watched', { season_number: seasonNumber });

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
            active="seasons"
            counts={{
              reviews: reviewsData?.reviews.length,
              seasons: seasons.length,
              lists: showLists?.length,
            }}
          />

          {seasons.map((s) => {
            // resolveScope at SEASON scope → season poster + "Season N" title + key.
            const resolved = resolveScope(
              { tmdb_show_id: tmdbShowId, season_number: s.season_number, episode_number: null },
              showCard,
            );
            const watched = seasonWatched.has(s.season_number);
            return (
              <SeasonRow
                key={resolved.key}
                tmdbShowId={tmdbShowId}
                posterPath={resolved.posterPath}
                title={resolved.title}
                episodeCount={s.episodes?.length ?? 0}
                year={s.air_date ? s.air_date.slice(0, 4) : null}
                watched={watched}
                onToggleWatched={() => onToggleSeason(s.season_number, watched)}
                onOpenSheet={() =>
                  openScope({ tmdb_show_id: tmdbShowId, season_number: s.season_number, episode_number: null })
                }
                onOpenDetail={() => router.push(`/show/${tmdbShowId}/season?season=${s.season_number}` as any)}
              />
            );
          })}
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

// One season row. BODY tap → that season's episode list; long-press → the season
// ScopeActions sheet. Eye = season-scope watched toggle (filled when watched);
// ••• = same ScopeActions sheet. Nested Pressables (eye / •••) capture their own
// touch, so a button tap never also fires the row's onPress — the tap-conflict
// guard, exactly as EpisodeRow does it.
function SeasonRow({
  tmdbShowId, posterPath, title, episodeCount, year, watched,
  onToggleWatched, onOpenSheet, onOpenDetail,
}: {
  tmdbShowId: number;
  posterPath: string | null;
  title: string;
  episodeCount: number;
  year: string | null;
  watched: boolean;
  onToggleWatched: () => void;
  onOpenSheet: () => void;
  onOpenDetail: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const meta = `${episodeCount} ${episodeCount === 1 ? 'episode' : 'episodes'}${year ? ` · ${year}` : ''}`;
  return (
    <Pressable style={styles.seasonRow} onPress={onOpenDetail} onLongPress={onOpenSheet} delayLongPress={280}>
      {/* Lazy season poster — Poster shows a skeleton until the image loads, so it
          never blocks scroll. pressable={false}: the ROW owns the tap. */}
      <Poster tmdbShowId={tmdbShowId} posterPath={posterPath} name={title} width={58} pressable={false} />

      <View style={styles.body}>
        <Text style={[type.reviewTitle, { color: colors.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[type.epRuntime, { color: colors.muted, marginTop: 2 }]}>{meta}</Text>
      </View>

      {/* Stacked inline actions (eye over •••), same as EpisodeRow. */}
      <View style={styles.actions}>
        <Pressable onPress={onToggleWatched} hitSlop={8} style={styles.actionBtn}>
          {/* Filled purple = season watched (the app's watched accent, same eye the
              episodes use), hollow grey = not — visible season-completion at a glance. */}
          <EyeIcon color={watched ? colors.purple : colors.faint} size={22} filled={watched} />
        </Pressable>
        <Pressable onPress={onOpenSheet} hitSlop={8} style={styles.actionBtn}>
          <DotsIcon color={colors.muted} size={20} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },

  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: pad,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 12,
  },
  body: { flex: 1 },
  actions: { alignItems: 'center', gap: 14 },
  actionBtn: { padding: 2 },
});
