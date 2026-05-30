import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateList } from '@/api/useListMutations';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { fetchShowCards } from '@/api/showCards';
import { SearchInput } from '@/components/SearchInput';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Poster } from '@/components/Poster';
import { ChevronLeftIcon, CloseIcon } from '@/components/icons';
import { colors, type, pad, fonts } from '@/theme';
import type { SearchShowResult } from '@/types';

type Staged = { tmdb_show_id: number; name: string; poster_path: string | null };

export default function NewList() {
  const { showId } = useLocalSearchParams<{ showId?: string }>();
  const { create, isPending } = useCreateList();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);

  // Pre-seed a show passed via ?showId (from "Add to lists… → New list").
  useEffect(() => {
    const id = showId ? Number(showId) : NaN;
    if (!Number.isInteger(id) || id <= 0) return;
    let alive = true;
    fetchShowCards([id]).then((cards) => {
      const c = cards.get(id);
      if (alive && c) {
        setStaged([{ tmdb_show_id: c.tmdb_show_id, name: c.name, poster_path: c.poster_path }]);
      }
    });
    return () => {
      alive = false;
    };
  }, [showId]);

  const stagedIds = new Set(staged.map((s) => s.tmdb_show_id));

  const addStaged = (r: SearchShowResult) => {
    if (stagedIds.has(r.tmdb_show_id)) return;
    setStaged((prev) => [...prev, { tmdb_show_id: r.tmdb_show_id, name: r.name, poster_path: r.poster_path }]);
    setQuery(''); // clear the search after adding
  };
  const removeStaged = (id: number) =>
    setStaged((prev) => prev.filter((s) => s.tmdb_show_id !== id));

  const canCreate = title.trim().length > 0 && !isPending;
  const searching = debounced.trim().length > 0;
  const results = (search.data?.results ?? []).filter((r) => !stagedIds.has(r.tmdb_show_id));

  const onCreate = async () => {
    if (!canCreate) return;
    try {
      const id = await create({
        title: title.trim(),
        description: description.trim() || null,
        showIds: staged.map((s) => s.tmdb_show_id),
      });
      if (id) router.replace(`/list/${id}` as any);
    } catch (e) {
      Alert.alert("Couldn't create list", e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>New list</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <TextField label="Title" value={title} onChangeText={setTitle} placeholder="List title" />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
          multiline
        />

        <Text style={styles.sectionLabel}>Shows{staged.length > 0 ? ` (${staged.length})` : ''}</Text>
        {/* The ScrollView body already pads by `pad`; cancel SearchInput's own
            horizontal margin so it lines up flush with the Title/Description fields. */}
        <SearchInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search shows to add"
          style={{ marginHorizontal: 0 }}
        />

        {searching &&
          (search.isLoading ? (
            <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
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

        {staged.length === 0 ? (
          <Text style={styles.muted}>No shows added yet.</Text>
        ) : (
          <View style={styles.stagedWrap}>
            {staged.map((s) => (
              <View key={s.tmdb_show_id} style={styles.row}>
                <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.name} width={40} pressable={false} />
                <Text style={[type.creator, { color: colors.ink, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                <Pressable onPress={() => removeStaged(s.tmdb_show_id)} hitSlop={8}>
                  <CloseIcon color={colors.muted} size={18} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 24 }}>
          <Button label="Create list" onPress={onCreate} disabled={!canCreate} loading={isPending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
  plus: { fontFamily: fonts.bold, fontSize: 22, color: colors.purple, paddingHorizontal: 4 },
  stagedWrap: { marginTop: 4 },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingVertical: 16,
  },
});
