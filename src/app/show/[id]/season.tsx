// /show/[id]/season?season=N — one season's EPISODE list. Reached by tapping a
// season ROW on the Seasons tab (the only "see episodes" path). Same episode rows
// as before (lazy still · scope label · title · own rating · eye + •••): the eye is
// the EPISODE-scope toggle (useToggleEpisodeWatched, delete-on-unwatch), the •••
// opens the episode ScopeActions sheet. "Mark all watched" (season-bulk) lives in
// the meta row here (the season ••• sheet was trimmed to View/Review/List). No new
// data: reads the season out of the cached show payload.
import { FlatList, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useShow } from '@/api/useShow';
import { useToggleEpisodeWatched, useMarkSeasonWatched } from '@/api/useToggleEpisodeWatched';
import { useSetWatchStatus } from '@/api/useSetWatchStatus';
import { EpisodeRow } from '@/components/EpisodeRow';
import { EpisodeRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon } from '@/components/icons';
import { useScopeSheet } from '@/lib/scopeSheet';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { TmdbEpisode, TmdbSeason } from '@/types';

export default function SeasonEpisodes() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id, season } = useLocalSearchParams<{ id: string; season: string }>();
  const tmdbShowId = Number(id);
  const seasonNumber = Number(season);
  const { data, isLoading, error } = useShow(tmdbShowId);
  const { toggle } = useToggleEpisodeWatched(tmdbShowId);
  const { markAll, isPending: markingAll } = useMarkSeasonWatched(tmdbShowId);
  const { clearStatus } = useSetWatchStatus(tmdbShowId); // un-mark the season row
  const openScope = useScopeSheet(); // ••• / long-press an episode → its scope actions

  const seasons = (data?.catalog.seasons ?? []) as TmdbSeason[];
  const current = seasons.find((s) => s.season_number === seasonNumber);
  const episodes = (current?.episodes ?? []) as TmdbEpisode[];

  const statuses = data?.mySocial.watch_statuses ?? [];

  // Watched episodes for THIS user, keyed "season:episode" — feeds each row's eye.
  const watchedKeys = new Set(
    statuses
      .filter((r) => r.season_number != null && r.episode_number != null)
      .map((r) => `${r.season_number}:${r.episode_number}`),
  );

  // A season- or show-scope `watched` row means "I watched this season" without
  // storing a row per episode. When either exists the episodes DERIVE as watched,
  // and their eyes LOCK (filled, non-tappable) — to change one, un-mark the season
  // (the meta-row control below). This is what keeps "Mark all watched" from
  // flooding the Diary: one season entry, not N episode entries.
  const seasonWatched = statuses.some(
    (r) => r.season_number === seasonNumber && r.episode_number == null && r.status === 'watched',
  );
  const showWatched = statuses.some(
    (r) => r.season_number == null && r.episode_number == null && r.status === 'watched',
  );
  const covered = seasonWatched || showWatched;

  // The user's OWN episode-scope ratings, keyed "season:episode" — each row's badge.
  const episodeRatings = new Map<string, number>(
    (data?.mySocial.ratings ?? [])
      .filter((r) => r.season_number != null && r.episode_number != null)
      .map((r) => [`${r.season_number}:${r.episode_number}`, r.score] as const),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]} numberOfLines={1}>
          Season {seasonNumber}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Skeleton ONLY on a genuine fetch (cold deep-link). Arriving from the
          Seasons tab the show is cached → isLoading is false → no skeleton flash
          for the common case, regardless of season size. */}
      {isLoading && <EpisodeRowsSkeleton />}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load show.</Text>}

      {data && !current && (
        <Text style={[styles.muted, styles.center]}>Season not found.</Text>
      )}

      {data && current && (
        // FlatList, NOT ScrollView + episodes.map(): virtualized, so only the
        // ~visible rows render on mount. A season with hundreds of episodes opens
        // as fast as a short one — no synchronous render of every row blocking the
        // push transition (that was the "takes a second to load" hang). flex:1 +
        // the screen's bounded height is what lets virtualization kick in. The meta
        // row is the list header so it scrolls away with the episodes.
        <FlatList
          style={{ flex: 1 }}
          data={episodes}
          // FlatList is a PureComponent: an episode-watched / rating optimistic
          // update changes `mySocial` but NOT `catalog`, so `episodes` keeps the
          // same reference and the visible rows wouldn't re-render (stale eye / star).
          // extraData on mySocial (a fresh ref after each social write) forces it.
          extraData={data.mySocial}
          keyExtractor={(ep) => `${ep.season_number}-${ep.episode_number}`}
          contentContainerStyle={{ paddingBottom: 80 }}
          ListHeaderComponent={
            <View style={styles.metaRow}>
              <Text style={[type.epRating, { color: colors.muted }]}>
                {episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'}
                {current.air_date && ` · ${current.air_date.slice(0, 4)}`}
              </Text>
              {/* Three states (no dead control): un-marked → "Mark all watched";
                  season marked → "Watched ✓ · Undo" (un-marks the season row);
                  whole show marked → a static label (manage at show scope). */}
              {showWatched ? (
                <Text style={[type.markAll, { color: colors.muted }]}>Whole show watched ✓</Text>
              ) : seasonWatched ? (
                <Pressable
                  hitSlop={8}
                  disabled={markingAll}
                  onPress={() => clearStatus({ season_number: seasonNumber, episode_number: null })}
                >
                  <Text style={[type.markAll, { color: colors.purple, opacity: markingAll ? 0.5 : 1 }]}>
                    Watched ✓ · Undo
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  hitSlop={8}
                  disabled={markingAll || episodes.length === 0}
                  onPress={() => markAll({ tmdb_show_id: tmdbShowId, season_number: current.season_number })}
                >
                  <Text style={[type.markAll, { color: colors.purple, opacity: markingAll ? 0.5 : 1 }]}>
                    Mark all watched ✓
                  </Text>
                </Pressable>
              )}
            </View>
          }
          renderItem={({ item: ep }) => {
            const key = `${ep.season_number}:${ep.episode_number}`;
            // Eye fills from the episode's own row OR a covering season/show row.
            const watched = covered || watchedKeys.has(key);
            return (
              <EpisodeRow
                seasonNumber={ep.season_number}
                episodeNumber={ep.episode_number}
                title={ep.name}
                airDate={ep.air_date}
                stillPath={ep.still_path}
                fallbackPosterPath={current.poster_path ?? data.catalog.poster_path}
                watched={watched}
                // Covered by a season/show mark → eye is filled + non-interactive.
                eyeLocked={covered}
                rating={episodeRatings.get(key) ?? null}
                onToggleWatched={() => toggle({
                  tmdb_show_id: tmdbShowId,
                  season_number: ep.season_number,
                  episode_number: ep.episode_number,
                  currentlyWatched: watched,
                })}
                onOpenDetail={() =>
                  router.push(`/show/${tmdbShowId}/episode?season=${ep.season_number}&episode=${ep.episode_number}` as any)
                }
                // ••• AND long-press → the full ScopeActions sheet for this episode.
                onOpenSheet={() => openScope({
                  tmdb_show_id: tmdbShowId,
                  season_number: ep.season_number,
                  episode_number: ep.episode_number,
                })}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
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
