import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useTrendingShows } from '@/api/useTrendingShows';
import { useShowsByGenre } from '@/api/useShowsByGenre';
import { useSearchShows } from '@/api/useSearchShows';
import { useSearchPeople } from '@/api/useSearchPeople';
import { useDebounce } from '@/lib/useDebounce';
import { useRecentSearches, type RecentSearch } from '@/lib/useRecentSearches';
import { genreName } from '@/lib/genres';
import { SearchInput } from '@/components/SearchInput';
import { SegmentTabs, type SegmentTab } from '@/components/SegmentTabs';
import { GenreChips } from '@/components/GenreChips';
import { ShowResultRow } from '@/components/ShowResultRow';
import { PersonRow } from '@/components/PersonRow';
import { ShowRowsSkeleton, PersonRowsSkeleton } from '@/components/Skeletons';
import { BottomNav } from '@/components/BottomNav';
import { type, pad, radius, type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';

type SearchTabKey = 'shows' | 'people' | 'lists';
const SEARCH_TABS: SegmentTab<SearchTabKey>[] = [
  { key: 'shows', label: 'Shows' },
  { key: 'people', label: 'People' },
  { key: 'lists', label: 'Lists' },
];

// Anonymous-safe: pure queries, no auth gate. Search is the first place users
// hit shows outside the seeded set — tapping one routes to /show/[id] where
// get-show lazily fetches + caches it.
export default function Search() {
  const styles = useThemedStyles(makeStyles);
  // Deep-link targets: Home's "follow people" prompt → ?tab=people; the FAB's
  // "Review or log" → ?log=1 (taps route to the composer instead of show detail).
  const { tab: tabParam, log } = useLocalSearchParams<{ tab?: string; log?: string }>();
  const logMode = log === '1';
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTabKey>(
    tabParam === 'people' || tabParam === 'lists' ? tabParam : 'shows',
  );
  // Recent searches show only while the search bar is focused; Trending is the
  // default before you tap in.
  const [focused, setFocused] = useState(false);
  // Selected genre chip (null = All → trending). Browse-by-genre on the empty
  // Shows state; single-select for v1.
  const [genre, setGenre] = useState<number | null>(null);

  // The DEBOUNCED value is what drives the search hooks (queryKey + enabled) —
  // so we hit the network on pause, not per keystroke.
  const debouncedQuery = useDebounce(query, 300);
  const searching = debouncedQuery.trim().length > 0;

  const trending = useTrendingShows(); // slim trending (direct shows_cache read)
  // Genre browse — same slim cache read, filtered. Only runs on the Shows tab
  // with a genre selected (off-tab / All → disabled, no fetch).
  const genreShows = useShowsByGenre(tab === 'shows' ? genre : null);
  const { recents, add: addRecent, clear: clearRecents } = useRecentSearches();
  // Each search is gated to its tab so we don't fetch the other tab's results.
  const showsQuery = useSearchShows(tab === 'shows' ? debouncedQuery : '');
  const peopleQuery = useSearchPeople(tab === 'people' ? debouncedQuery : '');

  // Tap a recent search → re-run it (fill the box + switch to its tab).
  const pickRecent = (r: RecentSearch) => {
    setQuery(r.query);
    setTab(r.kind);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder={logMode ? 'Search a show to review or log' : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <SegmentTabs tabs={SEARCH_TABS} active={tab} onChange={setTab} />

      {/* flex:1 keeps this scroll region filling the space above BottomNav in
          every state — otherwise a short body (loading skeleton, empty results,
          "Lists coming soon") lets BottomNav float up to the middle for a frame. */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'shows' &&
          (searching ? (
            <ShowResults query={showsQuery} onActivate={() => addRecent(query, 'shows')} logMode={logMode} />
          ) : (
            // Empty-box browse state: genre chips on top, then either the
            // genre-filtered set, recent searches (when focused), or trending.
            <>
              <GenreChips selected={genre} onSelect={setGenre} />
              {genre !== null ? (
                <GenreResults query={genreShows} genreId={genre} logMode={logMode} />
              ) : focused && recents.length > 0 ? (
                <RecentSearches recents={recents} onPick={pickRecent} onClear={clearRecents} />
              ) : (
                <Trending query={trending} logMode={logMode} />
              )}
            </>
          ))}
        {tab === 'people' && (
          <PeopleResults
            query={peopleQuery}
            searching={searching}
            onActivate={() => addRecent(query, 'people')}
          />
        )}
        {tab === 'lists' && <Text style={styles.muted}>Lists search is coming soon.</Text>}
      </ScrollView>

      <BottomNav active="search" />
    </SafeAreaView>
  );
}

// ----- Recent searches (empty Shows state) ----------------------------------

function RecentSearches({
  recents,
  onPick,
  onClear,
}: {
  recents: RecentSearch[];
  onPick: (r: RecentSearch) => void;
  onClear: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View>
      <View style={styles.recentHeader}>
        <Text style={styles.recentTitle}>Recent searches</Text>
        <Pressable onPress={onClear} hitSlop={8}>
          <Text style={styles.clearLink}>Clear</Text>
        </Pressable>
      </View>
      <View style={styles.recentList}>
        {recents.map((r) => (
          <Pressable key={`${r.kind}:${r.query}`} style={styles.recentRow} onPress={() => onPick(r)}>
            <Text style={styles.recentQuery} numberOfLines={1}>
              {r.query}
            </Text>
            <View style={styles.kindChip}>
              <Text style={styles.kindChipText}>{r.kind === 'shows' ? 'Show' : 'Person'}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ----- Shows ----------------------------------------------------------------

// Trending (default Shows state when there's no search history). Data arrives
// normalized to SearchShowResult, so rows render identically to search rows.
function Trending({ query, logMode }: { query: ReturnType<typeof useTrendingShows>; logMode?: boolean }) {
  const styles = useThemedStyles(makeStyles);
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t load trending.</Text>;
  if (query.isLoading) return <ShowRowsSkeleton />;
  const items = query.data ?? [];
  if (items.length === 0) return <Text style={styles.muted}>Nothing trending right now.</Text>;
  return (
    <View>
      <Text style={styles.sectionLabel}>Trending</Text>
      {items.map((it) => (
        <ShowResultRow key={it.tmdb_show_id} item={it} logMode={logMode} />
      ))}
    </View>
  );
}

// Genre browse results — same row + routing as Trending, just a filtered set.
// The empty copy is honest about being cache-bound (the cue to add /discover if
// a genre reads too thin).
function GenreResults({
  query,
  genreId,
  logMode,
}: {
  query: ReturnType<typeof useShowsByGenre>;
  genreId: number;
  logMode?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const name = genreName(genreId);
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t load {name}.</Text>;
  if (query.isLoading) return <ShowRowsSkeleton />;
  const items = query.data ?? [];
  if (items.length === 0) {
    return <Text style={styles.muted}>No {name} shows in the catalog yet.</Text>;
  }
  return (
    <View>
      <Text style={styles.sectionLabel}>{name}</Text>
      {items.map((it) => (
        <ShowResultRow key={it.tmdb_show_id} item={it} logMode={logMode} />
      ))}
    </View>
  );
}

function ShowResults({
  query,
  onActivate,
  logMode,
}: {
  query: ReturnType<typeof useSearchShows>;
  onActivate: () => void;
  logMode?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t search shows.</Text>;
  if (query.isLoading) return <ShowRowsSkeleton />;
  const results = query.data?.results ?? [];
  if (results.length === 0) return <Text style={styles.muted}>No shows found.</Text>;
  return (
    <View>
      {results.map((it) => (
        <ShowResultRow key={it.tmdb_show_id} item={it} onActivate={onActivate} logMode={logMode} />
      ))}
    </View>
  );
}

// ----- People ---------------------------------------------------------------

function PeopleResults({
  query,
  searching,
  onActivate,
}: {
  query: ReturnType<typeof useSearchPeople>;
  searching: boolean;
  onActivate: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  if (!searching) return <Text style={styles.muted}>Search for people by username.</Text>;
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t search people.</Text>;
  if (query.isLoading) return <PersonRowsSkeleton />;
  const results = query.data ?? [];
  if (results.length === 0) return <Text style={styles.muted}>No people found.</Text>;
  return (
    <View>
      {results.map((p) => (
        <PersonRow key={p.id} person={p} onActivate={onActivate} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { padding: pad },
  sectionLabel: {
    fontFamily: type.subhead.fontFamily,
    fontSize: type.subhead.fontSize,
    color: colors.ink,
    paddingHorizontal: pad,
    paddingTop: 14,
    paddingBottom: 2,
  },
  // Shared muted-centered text for empty / prompt / coming-soon states.
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 28,
  },

  // Recent searches
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingTop: 16,
    paddingBottom: 6,
  },
  recentTitle: {
    fontFamily: type.statLabel.fontFamily,
    fontSize: type.statLabel.fontSize,
    color: colors.faint,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clearLink: { fontFamily: type.reviewUser.fontFamily, fontSize: 13, color: colors.purple },
  recentList: { borderTopWidth: 1, borderTopColor: colors.hairline },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: pad,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  recentQuery: {
    flex: 1,
    fontFamily: type.creator.fontFamily,
    fontSize: type.creator.fontSize,
    color: colors.ink,
  },
  kindChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.field,
  },
  kindChipText: { fontFamily: type.reviewMeta.fontFamily, fontSize: 12, color: colors.muted },
});
