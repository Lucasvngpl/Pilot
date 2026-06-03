// /show/[id]/episode?season=&episode= — Episode Detail (noun-first). Reached by
// TAPPING an episode row on the Seasons tab (long-press there opens quick actions
// instead). Still hero + identity + overview, with the full <ScopeActions> for the
// episode tuple. No new data: reads the episode out of the cached show payload.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useShow } from '@/api/useShow';
import { ScopeActions } from '@/components/ScopeActions';
import { AddToListSheet } from '@/components/AddToListSheet';
import { ChevronLeftIcon } from '@/components/icons';
import { tmdbImage, formatScopeShort, formatAirDate } from '@/types';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function EpisodeDetail() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { id, season, episode } = useLocalSearchParams<{ id: string; season: string; episode: string }>();
  const tmdbShowId = Number(id);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  const { data, isLoading } = useShow(tmdbShowId);
  const [addToListOpen, setAddToListOpen] = useState(false);

  const catalog = data?.catalog;
  const ep = catalog?.seasons
    ?.find((s) => s.season_number === seasonNumber)
    ?.episodes?.find((e) => e.episode_number === episodeNumber);

  // Status + rating at THIS episode (JS scope-match, === null per CLAUDE.md).
  const social = data?.mySocial;
  const match = (r: { season_number: number | null; episode_number: number | null }) =>
    r.season_number === seasonNumber && r.episode_number === episodeNumber;
  const currentStatus = social?.watch_statuses.find(match)?.status ?? null;
  const currentRating = social?.ratings.find(match)?.score ?? null;

  const stillUri = tmdbImage(ep?.still_path, 'w780') ?? tmdbImage(catalog?.poster_path, 'w342');
  const heroH = Math.round((width * 9) / 16); // 16:9
  const scope = { tmdb_show_id: tmdbShowId, season_number: seasonNumber, episode_number: episodeNumber };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Episode</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading || !catalog ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.ink} />
      ) : !ep ? (
        <Text style={styles.notFound}>Episode not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          {stillUri ? (
            <Image source={{ uri: stillUri }} style={{ width, height: heroH }} contentFit="cover" transition={150} />
          ) : (
            <View style={{ width, height: heroH, backgroundColor: colors.field }} />
          )}

          <View style={styles.head}>
            <Text style={[type.epRating, { color: colors.muted }]}>
              {formatScopeShort(seasonNumber, episodeNumber)}
            </Text>
            <Text style={[type.sectionH, { color: colors.ink, marginTop: 2 }]}>{ep.name}</Text>
            {formatAirDate(ep.air_date) ? (
              <Text style={[type.filter, { color: colors.muted, marginTop: 4 }]}>{formatAirDate(ep.air_date)}</Text>
            ) : null}
          </View>

          <ScopeActions
            scope={scope}
            currentStatus={currentStatus}
            currentRating={currentRating}
            onRequestClose={() => {}}
            onAddToList={() => setAddToListOpen(true)}
          />

          {ep.overview ? <Text style={styles.overview}>{ep.overview}</Text> : null}
        </ScrollView>
      )}

      <AddToListSheet
        visible={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        tmdbShowId={tmdbShowId}
        scope={{ season_number: seasonNumber, episode_number: episodeNumber }}
      />
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
  head: { paddingHorizontal: pad, paddingTop: 14 },
  overview: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.ink,
    lineHeight: 21,
    paddingHorizontal: pad,
    marginTop: 8,
  },
  notFound: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, textAlign: 'center', marginTop: 40 },
});
