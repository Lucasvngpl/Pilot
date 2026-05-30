import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTrendingShows } from '@/api/useTrendingShows';
import { useSearchShows } from '@/api/useSearchShows';
import { useSearchPeople } from '@/api/useSearchPeople';
import { useDebounce } from '@/lib/useDebounce';
import { SearchInput } from '@/components/SearchInput';
import { SegmentTabs, type SegmentTab } from '@/components/SegmentTabs';
import { ShowResultRow } from '@/components/ShowResultRow';
import { PersonRow } from '@/components/PersonRow';
import { BottomNav } from '@/components/BottomNav';
import { colors, type, pad } from '@/theme';

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
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<SearchTabKey>('shows');

  // The DEBOUNCED value is what drives the search hooks (queryKey + enabled) —
  // so we hit the network on pause, not per keystroke.
  const debouncedQuery = useDebounce(query, 300);
  const searching = debouncedQuery.trim().length > 0;

  const trending = useTrendingShows(); // slim trending (direct shows_cache read)
  // Each search is gated to its tab so we don't fetch the other tab's results.
  const showsQuery = useSearchShows(tab === 'shows' ? debouncedQuery : '');
  const peopleQuery = useSearchPeople(tab === 'people' ? debouncedQuery : '');

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <SearchInput value={query} onChangeText={setQuery} />
      <SegmentTabs tabs={SEARCH_TABS} active={tab} onChange={setTab} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'shows' &&
          (searching ? <ShowResults query={showsQuery} /> : <Trending query={trending} />)}
        {tab === 'people' && <PeopleResults query={peopleQuery} searching={searching} />}
        {tab === 'lists' && <Text style={styles.muted}>Lists search is coming soon.</Text>}
      </ScrollView>

      <BottomNav active="search" />
    </SafeAreaView>
  );
}

// ----- Shows ----------------------------------------------------------------

// Trending (default Shows state). Data arrives already normalized to
// SearchShowResult from the hook, so rows render identically to search rows.
// Handling isError matters: the old code blocked on `!data`, so a failed fetch
// spun forever — now an error surfaces instead.
function Trending({ query }: { query: ReturnType<typeof useTrendingShows> }) {
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t load trending.</Text>;
  if (query.isLoading) return <ActivityIndicator style={styles.center} color={colors.ink} />;
  const items = query.data ?? [];
  if (items.length === 0) return <Text style={styles.muted}>Nothing trending right now.</Text>;
  return (
    <View>
      <Text style={styles.sectionLabel}>Trending</Text>
      {items.map((it) => (
        <ShowResultRow key={it.tmdb_show_id} item={it} />
      ))}
    </View>
  );
}

function ShowResults({ query }: { query: ReturnType<typeof useSearchShows> }) {
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t search shows.</Text>;
  if (query.isLoading) return <ActivityIndicator style={styles.center} color={colors.ink} />;
  const results = query.data?.results ?? [];
  if (results.length === 0) return <Text style={styles.muted}>No shows found.</Text>;
  return (
    <View>
      {results.map((it) => (
        <ShowResultRow key={it.tmdb_show_id} item={it} />
      ))}
    </View>
  );
}

// ----- People ---------------------------------------------------------------

function PeopleResults({
  query,
  searching,
}: {
  query: ReturnType<typeof useSearchPeople>;
  searching: boolean;
}) {
  if (!searching) return <Text style={styles.muted}>Search for people by username.</Text>;
  if (query.isError) return <Text style={styles.muted}>Couldn&apos;t search people.</Text>;
  if (query.isLoading) return <ActivityIndicator style={styles.center} color={colors.ink} />;
  const results = query.data ?? [];
  if (results.length === 0) return <Text style={styles.muted}>No people found.</Text>;
  return (
    <View>
      {results.map((p) => (
        <PersonRow key={p.id} person={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
});
