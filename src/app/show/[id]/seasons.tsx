// /show/[id]/seasons — season + episode browser for a show: season pills, per-episode rows with watched toggles.
import { ScrollView, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { usePopularReviews } from '@/api/usePopularReviews';
import { useShowLists } from '@/api/useShowLists';
import { useToggleEpisodeWatched, useMarkSeasonWatched } from '@/api/useToggleEpisodeWatched';
import { Tabs } from '@/components/Tabs';
import { SeasonPills } from '@/components/SeasonPills';
import { EpisodeRow } from '@/components/EpisodeRow';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { ShowCompactHeader } from '@/components/ShowCompactHeader';
import { useScopeSheet } from '@/lib/scopeSheet';
import { useRequireAuth } from '@/lib/requireAuth';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { TmdbSeason, TmdbEpisode } from '@/types';

export default function Seasons() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { toggle } = useToggleEpisodeWatched(tmdbShowId);
  const { markAll, isPending: markingAll } = useMarkSeasonWatched(tmdbShowId);
  const openScope = useScopeSheet(); // long-press an episode → its scope actions
  const requireAuth = useRequireAuth(); // gate the inline pencil before the composer
  // Real tab-count badges (cached, shared with the other tab screens).
  const { data: reviewsData } = usePopularReviews(tmdbShowId);
  const { data: showLists } = useShowLists(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  // Default to the FIRST real season (the seeder already drops season 0/specials);
  // a useState initializer runs once, and the show data is usually already cached
  // when you arrive from Overview, so the initial value is what you actually see.
  const initialSeason = seasons[0]?.season_number ?? 1;
  const [activeSeason, setActiveSeason] = useState<number>(initialSeason);
  const current = seasons.find((s) => s.season_number === activeSeason) ?? seasons[0];
  const episodes = (current?.episodes ?? []) as TmdbEpisode[];

  const watchedKeys = new Set(
    (data?.mySocial.watch_statuses ?? [])
      .filter((r) => r.season_number != null && r.episode_number != null)
      .map((r) => `${r.season_number}:${r.episode_number}`),
  );

  // The user's OWN episode-scope ratings, keyed by "season:episode" — feeds each
  // row's rating badge (shown only where the user actually rated; no community avg).
  const episodeRatings = new Map<string, number>(
    (data?.mySocial.ratings ?? [])
      .filter((r) => r.season_number != null && r.episode_number != null)
      .map((r) => [`${r.season_number}:${r.episode_number}`, r.score] as const),
  );

  // Show-scope status + rating — both feed `engaged` and the action sheet.
  const showScopeStatus = data?.mySocial.watch_statuses.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.status ?? null;
  const showScopeRating = data?.mySocial.ratings.find(
    (r) => r.season_number === null && r.episode_number === null,
  )?.score ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ShowNavRow
        status={showScopeStatus}
        onCheckPress={() => setSheetOpen(true)}
      />

      {isLoading && <ActivityIndicator style={styles.center} color={colors.ink} />}
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

          <SeasonPills
            seasons={seasons.map((s) => s.season_number)}
            active={activeSeason}
            onChange={setActiveSeason}
            // Long-press a season → that whole season's scope actions.
            onLongPress={(n) => openScope({ tmdb_show_id: tmdbShowId, season_number: n, episode_number: null })}
          />

          {current && (
            <View style={styles.metaRow}>
              <Text style={[type.epRating, { color: colors.muted }]}>
                {episodes.length} episodes
                {current.air_date && ` · ${current.air_date.slice(0, 4)}`}
              </Text>
              <Pressable
                hitSlop={8}
                disabled={markingAll || episodes.length === 0}
                onPress={() =>
                  markAll({
                    tmdb_show_id: tmdbShowId,
                    season_number: current.season_number,
                    episode_numbers: episodes.map((e) => e.episode_number),
                  })
                }
              >
                <Text style={[type.markAll, { color: colors.purple, opacity: markingAll ? 0.5 : 1 }]}>
                  Mark all watched ✓
                </Text>
              </Pressable>
            </View>
          )}

          {episodes.map((ep) => {
            const key = `${ep.season_number}:${ep.episode_number}`;
            const watched = watchedKeys.has(key);
            return (
              <EpisodeRow
                key={`${ep.season_number}-${ep.episode_number}`}
                seasonNumber={ep.season_number}
                episodeNumber={ep.episode_number}
                title={ep.name}
                airDate={ep.air_date}
                stillPath={ep.still_path}
                fallbackPosterPath={current?.poster_path ?? data?.catalog.poster_path}
                watched={watched}
                rating={episodeRatings.get(key) ?? null}
                onToggleWatched={() => toggle({
                  tmdb_show_id: tmdbShowId,
                  season_number: ep.season_number,
                  episode_number: ep.episode_number,
                  currentlyWatched: watched,
                })}
                onReview={async () => {
                  if (await requireAuth()) {
                    router.push(`/show/${tmdbShowId}/review?season=${ep.season_number}&episode=${ep.episode_number}` as any);
                  }
                }}
                onOpenDetail={() =>
                  router.push(`/show/${tmdbShowId}/episode?season=${ep.season_number}&episode=${ep.episode_number}` as any)
                }
                onLongPress={() => openScope({
                  tmdb_show_id: tmdbShowId,
                  season_number: ep.season_number,
                  episode_number: ep.episode_number,
                })}
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },
});
