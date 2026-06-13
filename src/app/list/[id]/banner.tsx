// /list/[id]/banner — pick a list's banner: a TMDb BACKDROP (16:9) from a show
// already in the list, or by searching any show; or reset to the auto-composite.
// v1 is backdrops-only (no photo upload): we store a `backdrop_path` reference, so
// there's no storage, no upload latency, and no user-image moderation surface.
//
// This is a real PUSHED ROUTE (it used to be a full-screen overlay component). As a
// Stack screen it gets the smooth native iOS swipe-back for free — so we dropped the
// hand-rolled Gesture.Pan + the swipe-back suppression the overlay needed.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useList } from '@/api/useLists';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { useSetListBanner } from '@/api/useListMutations';
import { fetchShowCards } from '@/api/showCards';
import { SearchInput } from '@/components/SearchInput';
import { Poster } from '@/components/Poster';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon, CheckIcon } from '@/components/icons';
import { tmdbImage, type SearchShowResult } from '@/types';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function ListBannerScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The list is already cached by the detail screen we pushed from — items +
  // current backdrop come straight from it (no new fetch on the common path).
  const { data: list } = useList(id);
  const { setBanner, isPending } = useSetListBanner();

  const items = list?.items ?? [];
  const currentBackdrop = list?.bannerBackdropPath ?? null;

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);
  const searching = debounced.trim().length > 0;
  const results = search.data?.results ?? [];

  // The list's shows that actually HAVE a backdrop, deduped by show (a list can hold
  // the same show at multiple scopes — one banner option per show).
  const seen = new Set<number>();
  const listBackdrops = items.filter((it) => {
    if (!it.backdrop_path || seen.has(it.tmdb_show_id)) return false;
    seen.add(it.tmdb_show_id);
    return true;
  });

  const apply = async (backdropPath: string | null) => {
    try {
      await setBanner(id, backdropPath);
      router.back(); // back to the detail; useSetListBanner invalidates it → fresh banner
    } catch (e) {
      Alert.alert("Couldn't update banner", e instanceof Error ? e.message : 'Please try again.');
    }
  };

  // A searched show: search results don't carry backdrop_path, so fetch the card
  // (cache → get-show) to read it. No backdrop on TMDb → tell the user, don't apply.
  const pickSearchResult = async (r: SearchShowResult) => {
    try {
      const cards = await fetchShowCards([r.tmdb_show_id]);
      const backdrop = cards.get(r.tmdb_show_id)?.backdrop_path ?? null;
      if (!backdrop) {
        Alert.alert('No banner image', `${r.name} has no backdrop image on TMDb.`);
        return;
      }
      await apply(backdrop);
    } catch (e) {
      Alert.alert("Couldn't load image", e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Choose banner</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ paddingHorizontal: pad }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search shows for a backdrop"
          style={{ marginHorizontal: 0 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {searching ? (
          search.isLoading ? (
            <SearchResultRowsSkeleton />
          ) : results.length === 0 ? (
            <Text style={styles.muted}>No shows found.</Text>
          ) : (
            results.map((r) => (
              <Pressable key={r.tmdb_show_id} style={styles.resultRow} onPress={() => pickSearchResult(r)} disabled={isPending}>
                <Poster tmdbShowId={r.tmdb_show_id} posterPath={r.poster_path} name={r.name} width={40} pressable={false} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>{r.name}</Text>
                  {r.first_air_date && <Text style={styles.sub}>{r.first_air_date.slice(0, 4)}</Text>}
                </View>
              </Pressable>
            ))
          )
        ) : (
          <>
            {/* Reset to the auto-composite (poster collage). */}
            <Pressable style={styles.defaultRow} onPress={() => apply(null)} disabled={isPending}>
              <Text style={[type.creator, { color: colors.ink }]}>Use default (poster collage)</Text>
              {currentBackdrop === null && <Check />}
            </Pressable>

            {listBackdrops.length > 0 && <Text style={styles.sectionLabel}>SHOWS IN THIS LIST</Text>}
            {listBackdrops.map((it) => {
              const uri = tmdbImage(it.backdrop_path, 'w780');
              const selected = currentBackdrop === it.backdrop_path;
              return (
                <Pressable key={it.tmdb_show_id} style={styles.bdCard} onPress={() => apply(it.backdrop_path!)} disabled={isPending}>
                  {/* Clean, full backdrop (no scrim) so you can actually see what
                      you're picking; the name is a caption BELOW it, like the rest
                      of the app labels art. */}
                  <View style={styles.bdImageWrap}>
                    {uri ? (
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.field }]} />
                    )}
                    {selected && <View style={styles.bdCheck}><Check /></View>}
                  </View>
                  <Text style={styles.bdName} numberOfLines={1}>{it.showName}</Text>
                </Pressable>
              );
            })}

            <Text style={styles.hint}>Tip: search any show above to use its backdrop.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Check() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.check}>
      <CheckIcon color={colors.white} size={13} />
    </View>
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
  body: { paddingHorizontal: pad, paddingTop: 8 },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.6, color: colors.faint, marginTop: 16, marginBottom: 8 },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },

  defaultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.hairline,
  },

  // 16:9 backdrop with the show name as a caption below it (no overlay scrim).
  bdCard: { marginBottom: 16 },
  bdImageWrap: {
    width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.field,
  },
  bdName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 8 },
  bdCheck: { position: 'absolute', top: 10, right: 10 },

  check: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint, textAlign: 'center', paddingVertical: 20 },
  muted: { fontFamily: type.reviewBody.fontFamily, fontSize: type.reviewBody.fontSize, color: colors.muted, paddingVertical: 16 },
});
