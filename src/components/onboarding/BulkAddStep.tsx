// Onboarding step 1 — "Add shows you've already watched". Search-first multi-select,
// exactly like /profile/bulk-watched, but the selection lives in the onboarding
// context (the user is still anonymous) and is flushed via the SAME bulk_mark_watched
// RPC once they sign in. We don't write here — nothing persists until auth.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { useOnboarding } from '@/lib/onboarding';
import { SearchInput } from '@/components/SearchInput';
import { Poster } from '@/components/Poster';
import { AddIndicator } from '@/components/AddIndicator';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export function BulkAddStep() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { watched, toggleWatched } = useOnboarding();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);
  const searching = debounced.trim().length > 0;
  const results = search.data?.results ?? [];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Add shows you&apos;ve watched</Text>
        <Text style={styles.subtitle}>
          Build your profile in seconds. Search and tap everything you&apos;ve already seen
          {watched.size > 0 ? ` — ${watched.size} selected` : ''}.
        </Text>
      </View>

      <View style={{ paddingHorizontal: pad }}>
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search shows you've watched"
          style={{ marginHorizontal: 0 }}
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {!searching ? (
          <Text style={styles.muted}>
            Search for shows you&apos;ve already seen, then tap to select them.
          </Text>
        ) : search.isLoading ? (
          <SearchResultRowsSkeleton />
        ) : results.length === 0 ? (
          <Text style={styles.muted}>No shows found.</Text>
        ) : (
          results.map((r) => {
            const on = watched.has(r.tmdb_show_id);
            const year = r.first_air_date ? r.first_air_date.slice(0, 4) : null;
            return (
              <Pressable
                key={r.tmdb_show_id}
                style={styles.row}
                onPress={() => toggleWatched(r.tmdb_show_id)}
              >
                <Poster
                  tmdbShowId={r.tmdb_show_id}
                  posterPath={r.poster_path}
                  name={r.name}
                  width={40}
                  pressable={false}
                />
                <View style={styles.rowText}>
                  <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  {year && <Text style={styles.sub}>{year}</Text>}
                </View>
                <AddIndicator added={on} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: { paddingHorizontal: pad, paddingTop: 4, paddingBottom: 12 },
    title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink, letterSpacing: -0.5 },
    subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 21 },
    body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    rowText: { flex: 1 },
    sub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
    muted: {
      fontFamily: type.reviewBody.fontFamily,
      fontSize: type.reviewBody.fontSize,
      color: colors.muted,
      paddingVertical: 16,
    },
  });
