// /person/[id] — actor/cast page: headshot + bio + the TV shows they appear in.
// The filename's [id] makes this a DYNAMIC route — Expo Router fills `id` from the
// URL (/person/123 → id = "123"). Reached by tapping a cast member on a show's
// Overview; tapping a show poster here goes on to that show. TV-only ("Appears in
// N shows"); data comes from the get-person Edge Function via the usePerson hook.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { usePerson } from '@/api/usePerson';
import { PosterGrid } from '@/components/PosterGrid';
import { ChevronLeftIcon } from '@/components/icons';
import { tmdbImage } from '@/types';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function PersonScreen() {
  const styles = useThemedStyles(makeStyles); // themed StyleSheet (re-themes live)
  const { colors } = useTheme();              // palette for inline colors in JSX
  // Read the route param. The <{ id: string }> generic types the result so `id`
  // is a string; params always arrive as strings, hence Number(id) below.
  const { id } = useLocalSearchParams<{ id: string }>();
  // usePerson returns the React Query result; we only need `data` + `isLoading`.
  // `data` is `Person | undefined` (undefined until the fetch resolves).
  const { data, isLoading } = usePerson(Number(id));
  const [expanded, setExpanded] = useState(false); // bio clamp: collapsed by default

  // `?.` (optional chaining) reads profile_path only if `data` exists, else undefined;
  // tmdbImage turns a TMDb path into a full URL (or null when there's no image).
  const photo = tmdbImage(data?.profile_path, 'w185');
  // `?? 0` (nullish coalescing): use the count if it exists, otherwise 0.
  const count = data?.shows.length ?? 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]} numberOfLines={1}>{data?.name ?? 'Person'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Conditional render: while loading (or no data yet) show a spinner, else
          the page. `||` short-circuits — if isLoading is true we never touch data. */}
      {isLoading || !data ? (
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.ink} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={styles.head}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, { backgroundColor: colors.field }]} />
            )}
            <Text style={[type.compactH, { color: colors.ink, flex: 1 }]}>{data.name}</Text>
          </View>

          {/* Render the bio only when there is one. Tapping toggles `expanded`;
              numberOfLines = undefined (no clamp) when expanded, 4 lines when not. */}
          {data.biography ? (
            <Pressable onPress={() => setExpanded((e) => !e)}>
              <Text style={styles.bio} numberOfLines={expanded ? undefined : 4}>{data.biography}</Text>
            </Pressable>
          ) : null}

          <Text style={styles.sectionLabel}>
            {/* Ternary picks singular/plural; the whole label hides the count at 0. */}
            {count > 0 ? `Appears in ${count} ${count === 1 ? 'show' : 'shows'}` : 'TV appearances'}
          </Text>
          {/* PosterGrid expects items with { tmdb_show_id, name, poster_path }.
              PersonShow has those (+ extra character/year), so it's assignable —
              TS structural typing: a wider object fits where a narrower one is asked.
              Each tile taps through to /show/[id] (Poster handles that itself). */}
          <PosterGrid items={data.shows} emptyText="No TV appearances." />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// makeStyles takes the active palette so colors re-read on a light/dark switch
// (a static StyleSheet would bake the color in once — see CLAUDE.md theme rules).
const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  head: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: pad, paddingVertical: 12 },
  photo: { width: 92, height: 138, borderRadius: radius.md }, // 2:3 headshot
  bio: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.ink,
    lineHeight: 21,
    paddingHorizontal: pad,
  },
  sectionLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: pad,
    marginTop: 24,
    marginBottom: 4,
  },
});
