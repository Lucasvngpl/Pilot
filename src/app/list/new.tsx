import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateList, useUpdateList, useListItemMutations } from '@/api/useListMutations';
import { useList } from '@/api/useLists';
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

// One screen, two modes:
//  - CREATE (default, or with ?showId pre-stage): make a new list.
//  - EDIT (?edit=listId): pre-loaded title/description/shows; "Save changes"
//    updates the list + reconciles items as a true set-difference (only the
//    genuine adds/removes are written — unchanged shows aren't touched).
export default function NewOrEditList() {
  const { showId, edit } = useLocalSearchParams<{ showId?: string; edit?: string }>();
  const isEdit = !!edit;

  const { create, isPending: creating } = useCreateList();
  const { update: updateList } = useUpdateList();
  const { add: addItem, remove: removeItem } = useListItemMutations();
  const { data: editList } = useList(edit); // disabled query when `edit` is undefined

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [originalIds, setOriginalIds] = useState<number[]>([]); // edit baseline for the diff
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);

  // CREATE: pre-seed a show passed via ?showId (from "Add to lists… → New list").
  useEffect(() => {
    if (isEdit) return;
    const sid = showId ? Number(showId) : NaN;
    if (!Number.isInteger(sid) || sid <= 0) return;
    let alive = true;
    fetchShowCards([sid]).then((cards) => {
      const c = cards.get(sid);
      if (alive && c) {
        setStaged([{ tmdb_show_id: c.tmdb_show_id, name: c.name, poster_path: c.poster_path }]);
      }
    });
    return () => { alive = false; };
  }, [showId, isEdit]);

  // EDIT: pre-fill title/description/shows once, and snapshot the original ids
  // so onSave can diff against them.
  useEffect(() => {
    if (isEdit && editList && !seeded) {
      setTitle(editList.title);
      setDescription(editList.description ?? '');
      const items = editList.items.map((i) => ({
        tmdb_show_id: i.tmdb_show_id, name: i.name, poster_path: i.poster_path,
      }));
      setStaged(items);
      setOriginalIds(items.map((i) => i.tmdb_show_id));
      setSeeded(true);
    }
  }, [isEdit, editList, seeded]);

  const stagedIds = new Set(staged.map((s) => s.tmdb_show_id));

  const addStaged = (r: SearchShowResult) => {
    if (stagedIds.has(r.tmdb_show_id)) return;
    setStaged((prev) => [...prev, { tmdb_show_id: r.tmdb_show_id, name: r.name, poster_path: r.poster_path }]);
    setQuery(''); // clear the search after adding
  };
  const removeStaged = (id: number) =>
    setStaged((prev) => prev.filter((s) => s.tmdb_show_id !== id));

  const busy = isEdit ? saving : creating;
  const canSubmit = title.trim().length > 0 && !busy;
  const searching = debounced.trim().length > 0;
  const results = (search.data?.results ?? []).filter((r) => !stagedIds.has(r.tmdb_show_id));

  const onCreate = async () => {
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

  const onSaveEdit = async () => {
    if (!edit) return;
    const editId = edit;
    setSaving(true);
    try {
      const ok = await updateList(editId, {
        title: title.trim(),
        description: description.trim() || null,
      });
      if (!ok) return; // login dismissed

      // True set-difference: only touch genuine adds/removes (positions of
      // unchanged shows stay put — no remove-all-then-add-all churn).
      const stagedNow = staged.map((s) => s.tmdb_show_id);
      const stagedSet = new Set(stagedNow);
      const originalSet = new Set(originalIds);
      const added = stagedNow.filter((id) => !originalSet.has(id));
      const removed = originalIds.filter((id) => !stagedSet.has(id));
      for (const sid of added) await addItem(editId, sid);
      for (const sid of removed) await removeItem(editId, sid);

      router.back();
    } catch (e) {
      Alert.alert("Couldn't save list", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = () => {
    if (!canSubmit) return;
    return isEdit ? onSaveEdit() : onCreate();
  };

  // Hold the form until the list loads in edit mode (cache is warm from the list
  // detail's useList — same query key — so this is usually instant).
  const editLoading = isEdit && !seeded;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>{isEdit ? 'Edit list' : 'New list'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {editLoading ? (
        <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
      ) : (
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
            <Button
              label={isEdit ? 'Save changes' : 'Create list'}
              onPress={onSubmit}
              disabled={!canSubmit}
              loading={busy}
            />
          </View>
        </ScrollView>
      )}
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
