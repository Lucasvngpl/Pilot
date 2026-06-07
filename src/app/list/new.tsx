import { useState, useEffect } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateList, useUpdateList, useListItemMutations } from '@/api/useListMutations';
import { useList } from '@/api/useLists';
import { fetchShowCards } from '@/api/showCards';
import { resolveScope } from '@/types';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { Poster } from '@/components/Poster';
import { Skeleton } from '@/components/Skeleton';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ListItemPicker, type ListPickerItem } from '@/components/ListItemPicker';
import { ChevronLeftIcon, CloseIcon, ChevronUpIcon, ChevronDownIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// A staged row IS a picker item — the add-item flow and the editor speak the same
// shape, so there's no translation between selecting and staging.
type Staged = ListPickerItem;

// One screen, two modes:
//  - CREATE (default, or with ?showId pre-stage): make a new list.
//  - EDIT (?edit=listId): pre-loaded title/description/items; "Save changes"
//    updates the list + reconciles items as a true set-difference (only the
//    genuine adds/removes are written — unchanged items aren't touched).
// BOTH modes add items through the SAME search-first ListItemPicker (show / season
// / episode), so a list can hold any scope from the moment it's created.
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
  const [pickerOpen, setPickerOpen] = useState(false);

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
      const card = cards.get(sid);
      const scoped = resolveScope(
        { tmdb_show_id: sid, season_number: seasonN, episode_number: episodeN },
        card,
      );
      setStaged([{
        tmdb_show_id: sid, season_number: seasonN, episode_number: episodeN,
        showName: card?.name ?? scoped.title, scopeTitle: scoped.title,
        poster_path: scoped.posterPath, scopeKey: scoped.key,
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
        showName: i.showName,
        scopeTitle: i.name, // ListShowItem.name is already the resolved scope title
        poster_path: i.poster_path,
        scopeKey: i.scopeKey,
      }));
      setStaged(items);
      setOriginalItems(items);
      setSeeded(true);
    }
  }, [isEdit, editList, seeded]);

  const stagedKeys = new Set(staged.map((s) => s.scopeKey));

  // Append a picked item (the picker dedupes by showing a check, but guard here
  // too in case of a double-fire). Scoped items (show / season / episode) all flow
  // through this one path now.
  const addStaged = (item: ListPickerItem) =>
    setStaged((prev) => (prev.some((s) => s.scopeKey === item.scopeKey) ? prev : [...prev, item]));
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

          <View style={styles.itemsHeader}>
            <Text style={styles.sectionLabel}>Items{staged.length > 0 ? ` (${staged.length})` : ''}</Text>
            <Pressable onPress={() => setPickerOpen(true)} hitSlop={8}>
              <Text style={styles.addItem}>+ Add item</Text>
            </Pressable>
          </View>

          {staged.length === 0 ? (
            <Text style={styles.muted}>No items added yet.</Text>
          ) : (
            <View style={styles.stagedWrap}>
              {staged.map((s, i) => {
                // Title = show name; sub-label = the scope. Whole-show rows say so
                // explicitly; scoped rows reuse the resolved scope title ("Season 2",
                // "S01 · E05 ‘…’") so a mixed-scope list is never ambiguous.
                const scopeLabel = s.season_number === null ? 'Whole show' : s.scopeTitle;
                return (
                  <View key={s.scopeKey} style={styles.row}>
                    <Text style={styles.stagedRank}>{i + 1}</Text>
                    <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.showName} width={40} pressable={false} />
                    <View style={styles.rowText}>
                      <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>{s.showName}</Text>
                      <Text style={styles.scopeLabel} numberOfLines={1}>{scopeLabel}</Text>
                    </View>
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
                );
              })}
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

      {/* The shared search-first add-item flow, full-screen over the editor. The
          editor keeps its staged state mounted underneath; the picker just toggles
          items into it and closing reveals the updated list. */}
      {pickerOpen && (
        <ListItemPicker
          mode={isEdit ? 'edit' : 'create'}
          stagedKeys={stagedKeys}
          onAdd={addStaged}
          onRemove={removeStaged}
          onClose={() => setPickerOpen(false)}
        />
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
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  addItem: { fontFamily: fonts.semibold, fontSize: 14, color: colors.purple },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowText: { flex: 1 },
  scopeLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
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
