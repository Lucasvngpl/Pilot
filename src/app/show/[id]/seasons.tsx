import { ScrollView, View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useShow } from '@/api/useShow';
import { useToggleEpisodeWatched } from '@/api/useToggleEpisodeWatched';
import { Poster } from '@/components/Poster';
import { Tabs } from '@/components/Tabs';
import { SeasonPills } from '@/components/SeasonPills';
import { EpisodeRow } from '@/components/EpisodeRow';
import { BottomNav } from '@/components/BottomNav';
import { ShowNavRow } from '@/components/ShowNavRow';
import { ShowActionSheet } from '@/components/ShowActionSheet';
import { StarIcon } from '@/components/icons';
import { colors, type, pad, fonts } from '@/theme';
import type { TmdbSeason, TmdbEpisode } from '@/types';

export default function Seasons() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { toggle } = useToggleEpisodeWatched(tmdbShowId);
  const [sheetOpen, setSheetOpen] = useState(false);

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];

  const initialSeason =
    seasons.find((s) => s.season_number === 2)?.season_number ??
    seasons[0]?.season_number ??
    1;
  const [activeSeason, setActiveSeason] = useState<number>(initialSeason);
  const current = seasons.find((s) => s.season_number === activeSeason) ?? seasons[0];
  const episodes = (current?.episodes ?? []) as TmdbEpisode[];

  const watchedKeys = new Set(
    (data?.mySocial.watch_statuses ?? [])
      .filter((r) => r.season_number != null && r.episode_number != null)
      .map((r) => `${r.season_number}:${r.episode_number}`),
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
          <CompactHeader
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
              reviews: 248,
              seasons: seasons.length,
              lists: 0,
            }}
          />

          <SeasonPills
            seasons={seasons.map((s) => s.season_number)}
            active={activeSeason}
            onChange={setActiveSeason}
          />

          {current && (
            <View style={styles.metaRow}>
              <Text style={[type.epRating, { color: colors.muted }]}>
                {episodes.length} episodes
                {current.air_date && ` · ${current.air_date.slice(0, 4)}`}
              </Text>
              <Pressable hitSlop={8}>
                <Text style={[type.markAll, { color: colors.purple }]}>Mark all watched ✓</Text>
              </Pressable>
            </View>
          )}

          {episodes.map((ep) => (
            <EpisodeRow
              key={`${ep.season_number}-${ep.episode_number}`}
              number={ep.episode_number}
              title={ep.name}
              runtimeMin={ep.runtime ?? undefined}
              rating={undefined}
              watched={watchedKeys.has(`${ep.season_number}:${ep.episode_number}`)}
              onToggle={() => toggle({
                tmdb_show_id: tmdbShowId,
                season_number: ep.season_number,
                episode_number: ep.episode_number,
                currentlyWatched: watchedKeys.has(`${ep.season_number}:${ep.episode_number}`),
              })}
            />
          ))}
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

function CompactHeader({
  name, rating, seasonsCount, episodesCount, posterPath, tmdbShowId,
}: {
  name: string;
  rating?: number;
  seasonsCount: number;
  episodesCount: number;
  posterPath?: string | null;
  tmdbShowId: number;
}) {
  return (
    <View style={styles.compact}>
      <Poster
        tmdbShowId={tmdbShowId}
        posterPath={posterPath}
        name={name}
        width={58}
        pressable={false}
      />
      <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
        <Text style={[type.compactH, { color: colors.ink }]} numberOfLines={1}>
          {name.toUpperCase()}
        </Text>
        <View style={styles.compactSub}>
          <StarIcon color={colors.gold} size={12} />
          <Text style={[type.epRuntime, { color: colors.muted, marginLeft: 4 }]}>
            {rating?.toFixed(1) ?? '—'} · {seasonsCount} seasons · {episodesCount} episodes
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  compact: { flexDirection: 'row', paddingHorizontal: pad, paddingBottom: 12 },
  compactSub: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
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
