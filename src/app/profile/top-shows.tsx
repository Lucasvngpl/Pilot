import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useTopShows } from '@/api/useTopShows';
import { useSetTopShows } from '@/api/useSetTopShows';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/Button';
import { Poster } from '@/components/Poster';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon, CloseIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { SearchShowResult } from '@/types';

const MAX = 4;

type Staged = { tmdb_show_id: number; name: string; poster_path: string | null };

// Edit screen for the Profile "Your Top 4". Order is add-order (first staged =
// slot 1) — no reorder UI in v1; remove + re-add to change order. Reuses the
// /list/new picker pattern (search → "+" to stage → removable rows).
export default function TopShowsEdit() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const myId = user?.id;
  const { data: existing } = useTopShows(myId);
  const { save, isPending } = useSetTopShows();

  const [staged, setStaged] = useState<Staged[]>([]);
  // Seed the staged list from the saved favorites exactly once, so it doesn't
  // clobber the user's in-progress edits when the query refetches.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && existing) {
      setStaged(existing.map((c) => ({
        tmdb_show_id: c.tmdb_show_id, name: c.name, poster_path: c.poster_path,
      })));
      setSeeded(true);
    }
  }, [existing, seeded]);

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);

  const stagedIds = new Set(staged.map((s) => s.tmdb_show_id));
  const full = staged.length >= MAX;

  const addStaged = (r: SearchShowResult) => {
    if (full || stagedIds.has(r.tmdb_show_id)) return;
    setStaged((prev) => [...prev, { tmdb_show_id: r.tmdb_show_id, name: r.name, poster_path: r.poster_path }]);
    setQuery(''); // clear search after adding
  };
  const removeStaged = (id: number) =>
    setStaged((prev) => prev.filter((s) => s.tmdb_show_id !== id));

  const searching = debounced.trim().length > 0;
  const results = (search.data?.results ?? []).filter((r) => !stagedIds.has(r.tmdb_show_id));

  const onSave = async () => {
    try {
      const ok = await save(staged.map((s) => s.tmdb_show_id));
      if (ok) router.back();
    } catch (e) {
      // PostgREST errors are plain objects, not Error instances — pull `.message`
      // explicitly so a real failure (missing table, RLS) is diagnosable, not "unknown".
      const message =
        e instanceof Error ? e.message
        : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message)
        : 'Please try again.';
      Alert.alert("Couldn't save", message);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Your Top 4</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>Favorites{staged.length > 0 ? ` (${staged.length}/${MAX})` : ''}</Text>

        {staged.length === 0 ? (
          <Text style={styles.muted}>No favorites yet — search below to add up to {MAX}.</Text>
        ) : (
          <View style={styles.stagedWrap}>
            {staged.map((s, i) => (
              <View key={s.tmdb_show_id} style={styles.row}>
                {/* slot number reflects add-order */}
                <Text style={styles.slotNum}>{i + 1}</Text>
                <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.name} width={40} pressable={false} />
                <Text style={[type.creator, { color: colors.ink, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                <Pressable onPress={() => removeStaged(s.tmdb_show_id)} hitSlop={8}>
                  <CloseIcon color={colors.muted} size={18} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Picker hidden at 4/4 — the counter + filled rows already say "full",
            and a message here read like a Save prerequisite. Remove a row to add. */}
        {!full && (
          <>
            <View style={{ height: 16 }} />
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search shows to add"
              style={{ marginHorizontal: 0 }}
            />
            {searching &&
              (search.isLoading ? (
                <SearchResultRowsSkeleton />
              ) : results.length === 0 ? (
                <Text style={styles.muted}>No shows found.</Text>
              ) : (
                results.map((r) => (
                  <Pressable key={r.tmdb_show_id} style={styles.row} onPress={() => addStaged(r)}>
                    <Poster tmdbShowId={r.tmdb_show_id} posterPath={r.poster_path} name={r.name} width={40} pressable={false} />
                    <Text style={[type.creator, { color: colors.ink, flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.plus}>+</Text>
                  </Pressable>
                ))
              ))}
          </>
        )}

        <View style={{ marginTop: 24 }}>
          <Button label="Save" onPress={onSave} loading={isPending} />
        </View>
      </ScrollView>
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
  body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 40 },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  slotNum: { fontFamily: fonts.bold, fontSize: 15, color: colors.muted, width: 14, textAlign: 'center' },
  plus: { fontFamily: fonts.bold, fontSize: 22, color: colors.purple, paddingHorizontal: 4 },
  stagedWrap: { marginTop: 4 },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingVertical: 16,
  },
});
