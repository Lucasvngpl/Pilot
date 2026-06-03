import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateList, useUpdateList, useListItemMutations } from '@/api/useListMutations';
import { useList } from '@/api/useLists';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { fetchShowCards } from '@/api/showCards';
import { resolveScope } from '@/types';
import { SearchInput } from '@/components/SearchInput';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Poster } from '@/components/Poster';
import { Skeleton } from '@/components/Skeleton';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { SearchShowResult } from '@/types';

// A staged item is a scope tuple (show / season / episode). `name`/`poster_path`
// are already resolved to THAT scope (resolveScope); `scopeKey` is the unique key.
type Staged = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  name: string;
  poster_path: string | null;
  scopeKey: string;
};

// One screen, two modes:
//  - CREATE (default, or with ?showId pre-stage): make a new list.
//  - EDIT (?edit=listId): pre-loaded title/description/shows; "Save changes"
//    updates the list + reconciles items as a true set-difference (only the
//    genuine adds/removes are written — unchanged shows aren't touched).
export default function NewOrEditList() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { showId, season, episode, edit } =
    useLocalSearchParams<{ showId?: string; season?: string; episode?: string; edit?: string }>();
  const isEdit = !!edit;

  const { create, isPending: creating } = useCreateList();
  const { update: updateList } = useUpdateList();
  const { add: addItem, remove: removeItem, reorder: reorderItems } = useListItemMutations();
  const { data: editList } = useList(edit); // disabled query when `edit` is undefined

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [originalItems, setOriginalItems] = useState<Staged[]>([]); // edit baseline for the diff
  const [seeded, setSeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 300);
  const search = useSearchShows(debounced);

  // CREATE: pre-seed the scope passed via ?showId (+ optional season/episode) from
  // "Add to lists… → New list". Resolves to the season/episode's own art + identity.
  useEffect(() => {
    if (isEdit) return;
    const sid = showId ? Number(showId) : NaN;
    if (!Number.isInteger(sid) || sid <= 0) return;
    const seasonN = season ? Number(season) : null;
    const episodeN = episode ? Number(episode) : null;
    let alive = true;
    fetchShowCards([sid], { withScopeArt: true }).then((cards) => {
      if (!alive) return;
      const scoped = resolveScope(
        { tmdb_show_id: sid, season_number: seasonN, episode_number: episodeN },
        cards.get(sid),
      );
      setStaged([{
        tmdb_show_id: sid, season_number: seasonN, episode_number: episodeN,
        name: scoped.title, poster_path: scoped.posterPath, scopeKey: scoped.key,
      }]);
    });
    return () => { alive = false; };
  }, [showId, season, episode, isEdit]);

  // EDIT: pre-fill title/description/items once, and snapshot the originals (with
  // scope) so onSave can diff against them. items already carry resolved scope.
  useEffect(() => {
    if (isEdit && editList && !seeded) {
      setTitle(editList.title);
      setDescription(editList.description ?? '');
      const items: Staged[] = editList.items.map((i) => ({
        tmdb_show_id: i.tmdb_show_id,
        season_number: i.season_number,
        episode_number: i.episode_number,
        name: i.name,
        poster_path: i.poster_path,
        scopeKey: i.scopeKey,
      }));
      setStaged(items);
      setOriginalItems(items);
      setSeeded(true);
    }
  }, [isEdit, editList, seeded]);

  const stagedKeys = new Set(staged.map((s) => s.scopeKey));

  // Search adds WHOLE-SHOW items (the list search is show-only); scoped items
  // arrive only via the pre-seed above. Dedup by scopeKey so the same scope isn't
  // staged twice (a show and one of its seasons are different keys — both allowed).
  const addStaged = (r: SearchShowResult) => {
    const key = `${r.tmdb_show_id}-x-x`;
    if (stagedKeys.has(key)) return;
    setStaged((prev) => [...prev, {
      tmdb_show_id: r.tmdb_show_id, season_number: null, episode_number: null,
      name: r.name, poster_path: r.poster_path, scopeKey: key,
    }]);
    setQuery(''); // clear the search after adding
  };
  const removeStaged = (key: string) =>
    setStaged((prev) => prev.filter((s) => s.scopeKey !== key));

  // Reorder via arrows (no drag/PanResponder — same call as Top 4): swap a row
  // with its neighbor. The staged order is the source of truth; onSave renumbers
  // positions to match it.
  const moveUp = (index: number) =>
    setStaged((prev) => {
      if (index <= 0) return prev;
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  const moveDown = (index: number) =>
    setStaged((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });

  const busy = isEdit ? saving : creating;
  const canSubmit = title.trim().length > 0 && !busy;
  const searching = debounced.trim().length > 0;
  const results = (search.data?.results ?? []).filter((r) => !stagedKeys.has(`${r.tmdb_show_id}-x-x`));

  const onCreate = async () => {
    try {
      const id = await create({
        title: title.trim(),
        description: description.trim() || null,
        items: staged.map((s) => ({
          tmdb_show_id: s.tmdb_show_id,
          season_number: s.season_number,
          episode_number: s.episode_number,
        })),
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

      // True set-difference BY SCOPE KEY (a show can appear at multiple scopes):
      // only touch genuine adds/removes, each at its exact scope.
      const stagedKeySet = new Set(staged.map((s) => s.scopeKey));
      const originalKeySet = new Set(originalItems.map((o) => o.scopeKey));
      const added = staged.filter((s) => !originalKeySet.has(s.scopeKey));
      const removed = originalItems.filter((o) => !stagedKeySet.has(o.scopeKey));
      for (const s of added) {
        await addItem(editId, s.tmdb_show_id, { season_number: s.season_number, episode_number: s.episode_number });
      }
      for (const o of removed) {
        await removeItem(editId, o.tmdb_show_id, { season_number: o.season_number, episode_number: o.episode_number });
      }

      // Renumber positions to the staged order. NOTE: keys by show id, so a list
      // holding the SAME show at multiple scopes can't be reordered precisely yet
      // (the deferred reorder-by-row-id item); correct for the common case.
      await reorderItems(editId, staged.map((s) => s.tmdb_show_id));

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
        // Form-shaped skeleton (Title + Description fields, then staged rows) —
        // mirrors the body below so the screen holds its shape while useList
        // hydrates. (Usually instant: the cache is warm from the list detail.)
        <View style={styles.body}>
          <Skeleton width={50} height={12} />
          <Skeleton height={44} style={{ marginTop: 8 }} />
          <Skeleton width={90} height={12} style={{ marginTop: 20 }} />
          <Skeleton height={44} style={{ marginTop: 8 }} />
          <Skeleton width={70} height={12} style={{ marginTop: 24 }} />
          <SearchResultRowsSkeleton count={3} />
        </View>
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

          {staged.length === 0 ? (
            <Text style={styles.muted}>No shows added yet.</Text>
          ) : (
            <View style={styles.stagedWrap}>
              {staged.map((s, i) => (
                <View key={s.scopeKey} style={styles.row}>
                  <Text style={styles.stagedRank}>{i + 1}</Text>
                  <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.name} width={40} pressable={false} />
                  <Text style={[type.creator, { color: colors.ink, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                  <View style={styles.stagedControls}>
                    <Pressable onPress={() => moveUp(i)} hitSlop={6} disabled={i === 0}>
                      <ChevronUpIcon color={i === 0 ? colors.hairline : colors.muted} size={20} />
                    </Pressable>
                    <Pressable onPress={() => moveDown(i)} hitSlop={6} disabled={i === staged.length - 1}>
                      <ChevronDownIcon color={i === staged.length - 1 ? colors.hairline : colors.muted} size={20} />
                    </Pressable>
                    <Pressable onPress={() => removeStaged(s.scopeKey)} hitSlop={6}>
                      <CloseIcon color={colors.muted} size={18} />
                    </Pressable>
                  </View>
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
  plus: { fontFamily: fonts.bold, fontSize: 22, color: colors.purple, paddingHorizontal: 4 },
  stagedWrap: { marginTop: 4 },
  stagedRank: { fontFamily: fonts.display, fontSize: 14, color: colors.muted, width: 18, textAlign: 'center' },
  stagedControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingVertical: 16,
  },
});
