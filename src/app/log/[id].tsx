// /log/[id] — the focused "log this" surface reached from the "+" → Review or log
// → search → tap a show. Whole show is preselected (one tap to rate = done), with
// optional progressive narrowing to a season then an episode. The resolved tuple
// drives <ScopeActions> (Rate · Review · Add to list · Mark watched).
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useShow } from '@/api/useShow';
import { ScopeActions } from '@/components/ScopeActions';
import { ScopePicker, type ScopeValue } from '@/components/ScopePicker';
import { AddToListSheet } from '@/components/AddToListSheet';
import { ChevronLeftIcon } from '@/components/icons';
import { tmdbImage, formatScopeShort } from '@/types';
import { type, pad, radius, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function LogShow() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading } = useShow(tmdbShowId);

  const [scope, setScope] = useState<ScopeValue>({ scopeKind: 'show', season: 1, episode: null });
  const [addToListOpen, setAddToListOpen] = useState(false);

  const catalog = data?.catalog;
  // Real seasons only (drop TMDb's "Specials" / season 0 from the picker).
  const seasons = (catalog?.seasons ?? []).filter((s) => s.season_number > 0);
  // Clamp the picked season to one that exists (the default starts at 1 before
  // data lands; if the show doesn't open on S1, fall back to its first season).
  const season = seasons.some((s) => s.season_number === scope.season)
    ? scope.season
    : seasons[0]?.season_number ?? 1;
  const episodesFor = (s: number) => seasons.find((x) => x.season_number === s)?.episodes ?? [];

  // The scope tuple ScopeActions + AddToListSheet act on.
  const resolved = {
    tmdb_show_id: tmdbShowId,
    season_number: scope.scopeKind === 'show' ? null : season,
    episode_number: scope.scopeKind === 'episode' ? scope.episode : null,
  };

  // Status + rating AT this exact scope (JS scope-match with === null — never a
  // SQL join, per CLAUDE.md). Drives the active pill + the picker's filled value.
  const social = data?.mySocial;
  const matchScope = (r: { season_number: number | null; episode_number: number | null }) =>
    r.season_number === resolved.season_number && r.episode_number === resolved.episode_number;
  const currentStatus = social?.watch_statuses.find(matchScope)?.status ?? null;
  const currentRating = social?.ratings.find(matchScope)?.score ?? null;

  const posterUrl = tmdbImage(catalog?.poster_path, 'w185');
  const year = catalog?.first_air_date?.slice(0, 4);

  // The confirmation line is the SOURCE OF TRUTH for what gets written — it must
  // name the exact tuple. Episode always carries its parent context (S1 · E3),
  // never a bare "E3" (same rule as list rows), plus the episode title when known.
  const episodeTitle =
    scope.scopeKind === 'episode'
      ? episodesFor(season).find((e) => e.episode_number === scope.episode)?.name
      : undefined;
  const scopeText =
    scope.scopeKind === 'show'
      ? catalog?.name ?? 'this show'
      : (formatScopeShort(resolved.season_number, resolved.episode_number) ?? '') +
        (scope.scopeKind === 'episode' && episodeTitle ? ` ‘${episodeTitle}’` : '');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Log</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading || !catalog ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.ink} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
          <View style={styles.hero}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={styles.poster} contentFit="cover" />
            ) : (
              <View style={[styles.poster, { backgroundColor: colors.field }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[type.sectionH, { color: colors.ink }]} numberOfLines={2}>{catalog.name}</Text>
              {year ? <Text style={[type.filter, { color: colors.muted, marginTop: 2 }]}>{year}</Text> : null}
            </View>
          </View>

          {seasons.length > 0 && (
            <View style={styles.picker}>
              <ScopePicker seasons={seasons} value={{ ...scope, season }} onChange={setScope} />
            </View>
          )}

          <Text style={styles.scopeText}>
            You&apos;re logging <Text style={styles.scopeStrong}>{scopeText}</Text>
          </Text>

          <ScopeActions
            scope={resolved}
            currentStatus={currentStatus}
            currentRating={currentRating}
            onRequestClose={() => {}}
            onAddToList={() => setAddToListOpen(true)}
          />
        </ScrollView>
      )}

      {/* Sibling overlay — must not be nested inside a positioned panel. */}
      <AddToListSheet
        visible={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        tmdbShowId={tmdbShowId}
        scope={{ season_number: resolved.season_number, episode_number: resolved.episode_number }}
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
  hero: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: pad, paddingVertical: 12 },
  poster: { width: 72, height: 108, borderRadius: radius.md },
  picker: { marginTop: 8 },
  scopeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: pad,
    marginTop: 16,
    // Balances the gap ABOVE the Watched pill (pillsRow paddingTop 16) against the
    // gap BELOW it (pillsRow paddingBottom 16 + RatingPicker paddingTop 18 = 34),
    // so the pill sits centered between this line and the rating stars.
    marginBottom: 18,
  },
  scopeStrong: { fontFamily: fonts.semibold, color: colors.ink },
});
