// ListBannerPicker — pick a list's banner: a TMDb BACKDROP (16:9) from a show
// already in the list, or by searching any show; or reset to the auto-composite.
// v1 is backdrops-only (no photo upload): we store a `backdrop_path` reference, so
// there's no storage, no upload latency, and no user-image moderation surface.
//
// Full-screen overlay over the list detail (same shell as ListItemPicker): own
// safe-area insets (absolute children ignore the parent's), suppress the native
// route swipe-back, and a left-edge Gesture.Pan that closes the picker — so a
// back-swipe feels native here too.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { useSuppressBackSwipe } from '@/lib/sheetGesture';
import { useSetListBanner } from '@/api/useListMutations';
import { fetchShowCards } from '@/api/showCards';
import { SearchInput } from '@/components/SearchInput';
import { Poster } from '@/components/Poster';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon, CheckIcon } from '@/components/icons';
import { tmdbImage, type ListShowItem, type SearchShowResult } from '@/types';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  listId: string;
  items: ListShowItem[];          // the list's rows — source of "shows in this list"
  currentBackdrop: string | null; // the active banner backdrop path (for the check)
  onClose: () => void;
};

export function ListBannerPicker({ listId, items, currentBackdrop, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useSuppressBackSwipe(true);
  const { setBanner, isPending } = useSetListBanner();

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

  const backSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(20)
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      const startX = e.absoluteX - e.translationX;
      if (startX < 40 && e.translationX > 60) onClose();
    });

  const apply = async (backdropPath: string | null) => {
    try {
      await setBanner(listId, backdropPath);
      onClose();
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
    <GestureDetector gesture={backSwipe}>
    <View style={styles.screen}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} hitSlop={8}>
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
    </GestureDetector>
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
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background },
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
