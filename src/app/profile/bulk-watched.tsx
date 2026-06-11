// /profile/bulk-watched — clear a backlog: search shows you've already seen and
// tap to multi-select, then mark them all watched in ONE batched RPC. Backlog marks
// fill the Shows→Watched grid but stay OUT of the Diary + time stats (undated).
// Reached from Settings.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { useBulkMarkWatched } from '@/api/useBulkMarkWatched';
import { SearchInput } from '@/components/SearchInput';
import { Poster } from '@/components/Poster';
import { Button } from '@/components/Button';
import { AddIndicator } from '@/components/AddIndicator';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export default function BulkWatched() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);
  const searching = debounced.trim().length > 0;
  const results = search.data?.results ?? [];

  // Local selection only — nothing writes until "Mark N watched".
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const { markWatched, isPending } = useBulkMarkWatched();

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const onMark = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const ok = await markWatched(ids);
      if (!ok) return; // login dismissed
      setSelected(new Set()); // clear, keep the screen open to continue
      Alert.alert('Marked watched', `${ids.length} ${ids.length === 1 ? 'show' : 'shows'} added to your watched.`);
    } catch (e) {
      Alert.alert("Couldn't mark watched", e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Mark shows watched</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={{ paddingHorizontal: pad }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search shows you've watched"
          style={{ marginHorizontal: 0 }}
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {!searching ? (
          <Text style={styles.muted}>Search for shows you&apos;ve already seen, then tap to select them.</Text>
        ) : search.isLoading ? (
          <SearchResultRowsSkeleton />
        ) : results.length === 0 ? (
          <Text style={styles.muted}>No shows found.</Text>
        ) : (
          results.map((r) => {
            const on = selected.has(r.tmdb_show_id);
            const year = r.first_air_date ? r.first_air_date.slice(0, 4) : null;
            return (
              <Pressable key={r.tmdb_show_id} style={styles.row} onPress={() => toggle(r.tmdb_show_id)}>
                <Poster tmdbShowId={r.tmdb_show_id} posterPath={r.poster_path} name={r.name} width={40} pressable={false} />
                <View style={styles.rowText}>
                  <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>{r.name}</Text>
                  {year && <Text style={styles.sub}>{year}</Text>}
                </View>
                <AddIndicator added={on} />
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Sticky footer — disabled until at least one show is selected. */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          label={selected.size > 0 ? `Mark ${selected.size} watched` : 'Mark watched'}
          onPress={onMark}
          disabled={selected.size === 0 || isPending}
          loading={isPending}
        />
      </View>
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
  body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowText: { flex: 1 },
  sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  muted: { fontFamily: type.reviewBody.fontFamily, fontSize: type.reviewBody.fontSize, color: colors.muted, paddingVertical: 16 },
  footer: {
    paddingHorizontal: pad,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
  },
});
