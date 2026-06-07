// ListItemPicker — the SINGLE search-first add-item flow for list create + edit.
//
// Replaces the old "search → adds whole show only" field on the New/Edit-list
// screen. It mirrors the app's own Show → Seasons → Episodes navigation so the
// mental model is reused, and it reads seasons/episodes straight out of the
// cached get-show payload (useShow) — NO new TMDb/Edge Function calls (the same
// data the Seasons tab already renders).
//
// Three levels, scope-as-refinement (the common case is one tap = whole show):
//   1. search   — show results. Row body tap = add WHOLE show. Trailing › = drill in.
//   2. show      — "Add whole show" + the show's real seasons. Season tap = add season; › = drill.
//   3. season    — the season's real episodes. Episode tap = add episode. No further drill.
//
// Adding is a TOGGLE against the parent's staged set: an already-added scope shows
// a check and tapping it removes it, so you can't dupe (the UNIQUE NULLS NOT
// DISTINCT constraint backs this on the server too). Adding KEEPS you on the
// current level (multi-add from one show/season); the ‹ chevron walks back up,
// and ‹ at the search level closes the picker back to the list editor.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useShow } from '@/api/useShow';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { useSuppressBackSwipe } from '@/lib/sheetGesture';
import { SearchInput } from '@/components/SearchInput';
import { Poster } from '@/components/Poster';
import { SearchResultRowsSkeleton, EpisodeRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '@/components/icons';
import {
  resolveScope, buildScopeArt, tmdbImage, formatScopeShort,
  type ShowCard, type TmdbSeason, type TmdbEpisode, type SearchShowResult,
} from '@/types';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// One staged list item — a scope tuple resolved to its own art + identity.
// `showName` is always the show (the title line); `scopeTitle` is resolveScope's
// scope title (e.g. "Season 2", "S01 · E05 ‘…’") used as the sub-label.
export type ListPickerItem = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  showName: string;
  scopeTitle: string;
  poster_path: string | null;
  scopeKey: string;
};

// Which level the picker is showing. `show`/`season` carry the breadcrumb so the
// header can render "‹ <show> · Season N" without re-reading it. (Named
// PickerLevel, not View — `View` is already React Native's component here.)
type PickerLevel =
  | { level: 'search' }
  | { level: 'show'; showId: number; showName: string }
  | { level: 'season'; showId: number; showName: string; season: number };

type Props = {
  // Editor mode — only changes the search-level title ("New list" / "Edit list").
  mode: 'create' | 'edit';
  // scopeKeys already in the in-progress list → drives the checks + dedupe.
  stagedKeys: Set<string>;
  onAdd: (item: ListPickerItem) => void;
  onRemove: (scopeKey: string) => void;
  onClose: () => void;
};

export function ListItemPicker({ mode, stagedKeys, onAdd, onRemove, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // While the picker is up, drop the screen's native iOS edge-swipe-back so a
  // back-swipe walks the picker's OWN levels (below) instead of popping the whole
  // editor route. Released automatically when the picker unmounts (it only mounts
  // while open). Same primitive the sheets + rating slider use.
  useSuppressBackSwipe(true);

  const [view, setView] = useState<PickerLevel>({ level: 'search' });
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);

  // The drilled show's full catalog (seasons + episodes). `enabled` is false at the
  // search level (showId undefined), so this is a no-op there. Arriving from the
  // editor the show is usually already cached → instant, no skeleton flash.
  const drillShowId = view.level === 'search' ? undefined : view.showId;
  const show = useShow(drillShowId);

  // A card carrying per-scope art so resolveScope returns each season/episode's
  // OWN poster/still + title + key — the same resolver the Seasons tab and list
  // detail use, so a staged item looks identical wherever it appears later.
  const card: ShowCard | undefined =
    drillShowId && show.data
      ? {
          tmdb_show_id: drillShowId,
          name: show.data.catalog.name,
          poster_path: show.data.catalog.poster_path ?? null,
          scopeArt: buildScopeArt(show.data.catalog),
        }
      : undefined;

  // Add if absent, remove if present — the same toggle AddToListSheet uses, so a
  // second tap on a checked row can't create a duplicate scope.
  const toggle = (item: ListPickerItem) =>
    stagedKeys.has(item.scopeKey) ? onRemove(item.scopeKey) : onAdd(item);

  // Build the staged item for a given scope tuple via resolveScope (single source
  // of poster/title/key). `card` is undefined for a search-level whole-show add
  // (search returns slim results, no scopeArt) — resolveScope still gives the
  // right name/poster/key from the tuple, falling back to the show poster.
  const itemFor = (
    tmdb_show_id: number,
    season: number | null,
    episode: number | null,
    forCard: ShowCard | undefined,
    fallbackName: string,
    fallbackPoster: string | null,
  ): ListPickerItem => {
    const r = resolveScope({ tmdb_show_id, season_number: season, episode_number: episode }, forCard);
    return {
      tmdb_show_id,
      season_number: season,
      episode_number: episode,
      showName: forCard?.name ?? fallbackName,
      scopeTitle: r.title,
      poster_path: r.posterPath ?? fallbackPoster,
      scopeKey: r.key,
    };
  };

  // ----- header (back chevron + breadcrumb + title) --------------------------
  const headerTitle =
    view.level === 'search' ? (mode === 'edit' ? 'Edit list' : 'New list') : 'Add from show';
  const breadcrumb =
    view.level === 'show' ? view.showName
    : view.level === 'season' ? `${view.showName} · Season ${view.season}`
    : null;

  const goBack = () => {
    // Walk up one level; at the search level, ‹ (or the edge-swipe) closes the picker.
    if (view.level === 'season') setView({ level: 'show', showId: view.showId, showName: view.showName });
    else if (view.level === 'show') setView({ level: 'search' });
    else onClose();
  };

  // Left-edge swipe-back, like every iOS screen. runOnJS(true) keeps the callback
  // on the JS thread (no reanimated worklet), so it can call goBack directly.
  // activeOffsetX → only claims a rightward horizontal drag; failOffsetY → yields
  // to the vertical lists; we additionally require the drag to START near the left
  // edge so it never fights a horizontal scroll mid-screen.
  const backSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(20)
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      const startX = e.absoluteX - e.translationX;
      if (startX < 40 && e.translationX > 60) goBack();
    });

  return (
    // Full-screen overlay over the editor. A plain absolute-fill View covering the
    // WHOLE frame (absolute children ignore the parent SafeAreaView's padding), so
    // the nav + footer apply the safe-area insets themselves. The editor keeps its
    // state mounted underneath, so closing just reveals it with the new items staged.
    <GestureDetector gesture={backSwipe}>
    <View style={styles.screen}>
      <View style={[styles.nav, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]} numberOfLines={1}>{headerTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      {breadcrumb && (
        <Text style={styles.breadcrumb} numberOfLines={1}>{breadcrumb}</Text>
      )}

      {view.level === 'search' && (
        <SearchLevel
          query={query}
          setQuery={setQuery}
          searching={debounced.trim().length > 0}
          loading={search.isLoading}
          results={search.data?.results ?? []}
          stagedKeys={stagedKeys}
          onAddShow={(r) => toggle(itemFor(r.tmdb_show_id, null, null, undefined, r.name, r.poster_path))}
          onDrill={(r) => setView({ level: 'show', showId: r.tmdb_show_id, showName: r.name })}
        />
      )}

      {view.level === 'show' && (
        <ShowLevel
          loading={show.isLoading}
          error={!!show.error}
          card={card}
          seasons={(show.data?.catalog.seasons ?? []) as TmdbSeason[]}
          stagedKeys={stagedKeys}
          onAddWhole={() => card && toggle(itemFor(view.showId, null, null, card, view.showName, null))}
          onAddSeason={(s) => card && toggle(itemFor(view.showId, s, null, card, view.showName, null))}
          onDrill={(s) => setView({ level: 'season', showId: view.showId, showName: view.showName, season: s })}
        />
      )}

      {view.level === 'season' && (
        <SeasonLevel
          loading={show.isLoading}
          showId={view.showId}
          season={view.season}
          episodes={
            ((show.data?.catalog.seasons ?? []) as TmdbSeason[])
              .find((s) => s.season_number === view.season)?.episodes ?? []
          }
          stagedKeys={stagedKeys}
          onAddEpisode={(e) => card && toggle(itemFor(view.showId, view.season, e, card, view.showName, null))}
        />
      )}
    </View>
    </GestureDetector>
  );
}

// ----- Level 1: search results --------------------------------------------------

function SearchLevel({
  query, setQuery, searching, loading, results, stagedKeys, onAddShow, onDrill,
}: {
  query: string;
  setQuery: (v: string) => void;
  searching: boolean;
  loading: boolean;
  results: SearchShowResult[];
  stagedKeys: Set<string>;
  onAddShow: (r: SearchShowResult) => void;
  onDrill: (r: SearchShowResult) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <>
      <View style={{ paddingHorizontal: pad }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search shows to add"
          style={{ marginHorizontal: 0 }}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!searching ? (
          <Text style={styles.muted}>Search for a show to add.</Text>
        ) : loading ? (
          <SearchResultRowsSkeleton />
        ) : results.length === 0 ? (
          <Text style={styles.muted}>No shows found.</Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>RESULTS</Text>
            {results.map((r) => {
              const staged = stagedKeys.has(`${r.tmdb_show_id}-x-x`);
              const year = r.first_air_date ? r.first_air_date.slice(0, 4) : null;
              return (
                // Two distinct targets on one row: the BODY adds the whole show,
                // the trailing › drills in. Nested Pressables capture their own
                // touch, so a chevron tap never also fires the body's onPress.
                <View key={r.tmdb_show_id} style={styles.row}>
                  <Pressable style={styles.rowBody} onPress={() => onAddShow(r)}>
                    <Poster tmdbShowId={r.tmdb_show_id} posterPath={r.poster_path} name={r.name} width={40} pressable={false} />
                    <View style={styles.rowText}>
                      <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>{r.name}</Text>
                      {year && <Text style={styles.sub}>{year}</Text>}
                    </View>
                    {staged && <Check />}
                  </Pressable>
                  <Pressable onPress={() => onDrill(r)} hitSlop={8} style={styles.chevronBtn}>
                    <ChevronRightIcon color={colors.faint} size={22} />
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Hint text="Tap a show to add it whole — or › to pick a season or episode." />
    </>
  );
}

// ----- Level 2: a show's seasons ------------------------------------------------

function ShowLevel({
  loading, error, card, seasons, stagedKeys, onAddWhole, onAddSeason, onDrill,
}: {
  loading: boolean;
  error: boolean;
  card: ShowCard | undefined;
  seasons: TmdbSeason[];
  stagedKeys: Set<string>;
  onAddWhole: () => void;
  onAddSeason: (season: number) => void;
  onDrill: (season: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  if (loading || !card) return <View style={{ flex: 1 }}><SearchResultRowsSkeleton /></View>;
  if (error) return <Text style={[styles.muted, { paddingHorizontal: pad }]}>Couldn&apos;t load show.</Text>;

  const wholeStaged = stagedKeys.has(`${card.tmdb_show_id}-x-x`);

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {/* Clear commit affordance once you've drilled in (same as tapping the row). */}
        <Pressable style={styles.row} onPress={onAddWhole}>
          <Poster tmdbShowId={card.tmdb_show_id} posterPath={card.poster_path} name={card.name} width={40} pressable={false} />
          <View style={styles.rowText}>
            <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>Add whole show</Text>
            <Text style={styles.sub} numberOfLines={1}>{card.name}</Text>
          </View>
          {wholeStaged && <Check />}
        </Pressable>

        <Text style={[styles.sectionLabel, { marginTop: 14 }]}>OR PICK A SEASON</Text>
        {seasons.map((s) => {
          // resolveScope at SEASON scope → season poster + "Season N" title + key.
          const r = resolveScope(
            { tmdb_show_id: card.tmdb_show_id, season_number: s.season_number, episode_number: null },
            card,
          );
          const count = s.episodes?.length ?? 0;
          const year = s.air_date ? s.air_date.slice(0, 4) : null;
          const meta = [year, `${count} ${count === 1 ? 'episode' : 'episodes'}`].filter(Boolean).join(' · ');
          const staged = stagedKeys.has(r.key);
          return (
            <View key={r.key} style={styles.row}>
              <Pressable style={styles.rowBody} onPress={() => onAddSeason(s.season_number)}>
                <Poster tmdbShowId={card.tmdb_show_id} posterPath={r.posterPath} name={r.title} width={40} pressable={false} />
                <View style={styles.rowText}>
                  <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{meta}</Text>
                </View>
                {staged && <Check />}
              </Pressable>
              <Pressable onPress={() => onDrill(s.season_number)} hitSlop={8} style={styles.chevronBtn}>
                <ChevronRightIcon color={colors.faint} size={22} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      <Hint text="Tap a season to add it — or › to drill into episodes." />
    </>
  );
}

// ----- Level 3: a season's episodes ---------------------------------------------

function SeasonLevel({
  loading, showId, season, episodes, stagedKeys, onAddEpisode,
}: {
  loading: boolean;
  showId: number;
  season: number;
  episodes: TmdbEpisode[];
  stagedKeys: Set<string>;
  onAddEpisode: (episode: number) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) return <View style={{ flex: 1 }}><EpisodeRowsSkeleton /></View>;
  if (episodes.length === 0) return <Text style={[styles.muted, { paddingHorizontal: pad }]}>No episodes found.</Text>;

  return (
    // FlatList (virtualized) so a season with hundreds of episodes opens as fast
    // as a short one — the same reason the Season screen uses one.
    <FlatList
      style={{ flex: 1 }}
      data={episodes}
      keyExtractor={(e) => `${e.season_number}-${e.episode_number}`}
      contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}
      renderItem={({ item: e }) => {
        // resolveScope's key format (`${show}-${season}-${episode}`) — built here
        // from the showId/season the parent passed so the check matches staged items.
        const staged = stagedKeys.has(`${showId}-${season}-${e.episode_number}`);
        // The episode's still (same 16:9 thumbnail the Seasons → episode list uses).
        const stillUri = tmdbImage(e.still_path, 'w342');
        return (
          <Pressable style={styles.row} onPress={() => onAddEpisode(e.episode_number)}>
            <View style={styles.still}>
              {stillUri ? (
                <Image source={{ uri: stillUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.field }]} />
              )}
            </View>
            <View style={styles.rowText}>
              <Text style={[type.epRating, { color: colors.muted }]}>{formatScopeShort(season, e.episode_number)}</Text>
              <Text style={[type.reviewTitle, { color: colors.ink, marginTop: 1 }]} numberOfLines={1}>{e.name}</Text>
              {e.air_date && <Text style={[styles.sub, { marginTop: 2 }]}>{e.air_date.slice(0, 4)}</Text>}
            </View>
            {staged && <Check />}
          </Pressable>
        );
      }}
    />
  );
}

// ----- small shared bits --------------------------------------------------------

function Check() {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.check}>
      <CheckIcon color={colors.white} size={13} />
    </View>
  );
}

function Hint({ text }: { text: string }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // Clear the home indicator — the overlay covers the whole frame, so the footer
  // owns its own bottom inset.
  return <Text style={[styles.hint, { paddingBottom: 14 + insets.bottom }]}>{text}</Text>;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // Full-screen overlay over the editor (absolute fill, opaque background).
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  breadcrumb: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, paddingHorizontal: pad, marginBottom: 4 },
  body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 24 },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.6, color: colors.faint, marginBottom: 6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1 },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  chevronBtn: { padding: 4 },

  // 16:9 landscape still — matches the Seasons → episode list thumbnail.
  still: { width: 104, height: 58, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.field },

  check: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  muted: { fontFamily: type.reviewBody.fontFamily, fontSize: type.reviewBody.fontSize, color: colors.muted, paddingVertical: 16 },
  hint: {
    fontFamily: fonts.regular, fontSize: 13, color: colors.faint,
    paddingHorizontal: pad, paddingVertical: 14, textAlign: 'center',
    borderTopWidth: 1, borderTopColor: colors.hairline,
  },
});
