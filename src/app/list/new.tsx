import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DragList, { type DragListRenderItemInfo } from 'react-native-draglist';
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
import { ChevronLeftIcon, CloseIcon, GripIcon } from '@/components/icons';
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

  const { create } = useCreateList();
  const { update: updateList } = useUpdateList();
  const { add: addItem, remove: removeItem, reorder: reorderItems } = useListItemMutations();
  const { data: editList } = useList(edit); // disabled query when `edit` is undefined

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [staged, setStaged] = useState<Staged[]>([]);
  const [originalItems, setOriginalItems] = useState<Staged[]>([]); // edit baseline for the diff
  const [seeded, setSeeded] = useState(false);
  // Which footer action is running ('draft' = Save draft, 'main' = Create/Publish/Save),
  // so only the tapped button shows a spinner — mirrors the review composer.
  const [pending, setPending] = useState<'draft' | 'main' | null>(null);
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

  // Drag-to-reorder (react-native-draglist hands us the row's start + drop index).
  // Pull the row out and reinsert it at the drop point. The staged order stays the
  // source of truth — onSave renumbers list_items.position to match it, so the new
  // order persists once you Save (create writes positions by index; edit calls
  // reorderItems with the staged order).
  const onReordered = (fromIndex: number, toIndex: number) =>
    setStaged((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

  const busy = pending !== null;
  const isDraftEdit = isEdit && editList?.is_draft === true;
  // Offer Save draft when CREATING or editing an existing draft — never when
  // editing an already-published list (publishing is one-way, like reviews).
  const showDraftActions = !isEdit || isDraftEdit;
  // Any field touched → there's something worth stashing. A draft needs NO title;
  // Create/Publish still require one.
  const hasContent = title.trim().length > 0 || description.trim().length > 0 || staged.length > 0;
  const titled = title.trim().length > 0;

  // Reconcile items for an existing list: a true set-difference BY SCOPE KEY (a show
  // can appear at multiple scopes), then renumber positions to the staged order.
  const reconcileItems = async (editId: string) => {
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
    // NOTE: keys by show id, so a list holding the SAME show at multiple scopes
    // can't be reordered precisely yet (deferred reorder-by-row-id); fine for now.
    await reorderItems(editId, staged.map((s) => s.tmdb_show_id));
  };

  // CREATE — asDraft=true saves an (optionally untitled) draft and returns; false
  // publishes and opens the new list.
  const onCreate = async (asDraft: boolean) => {
    setPending(asDraft ? 'draft' : 'main');
    try {
      const id = await create({
        title: title.trim(),
        description: description.trim() || null,
        items: staged.map((s) => ({
          tmdb_show_id: s.tmdb_show_id,
          season_number: s.season_number,
          episode_number: s.episode_number,
        })),
        is_draft: asDraft,
      });
      if (id) asDraft ? router.back() : router.replace(`/list/${id}` as any);
    } catch (e) {
      Alert.alert("Couldn't save list", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPending(null);
    }
  };

  // EDIT — 'draft' keeps it a draft, 'publish' flips it live (→ its detail), 'save'
  // is a plain save of an already-published list (flag untouched).
  const onSaveEdit = async (mode: 'draft' | 'publish' | 'save') => {
    if (!edit) return;
    const editId = edit;
    setPending(mode === 'draft' ? 'draft' : 'main');
    try {
      const is_draft = mode === 'publish' ? false : mode === 'draft' ? true : undefined;
      const ok = await updateList(editId, {
        title: title.trim(),
        description: description.trim() || null,
        is_draft,
      });
      if (!ok) return; // login dismissed
      await reconcileItems(editId);
      mode === 'publish' ? router.replace(`/list/${editId}` as any) : router.back();
    } catch (e) {
      Alert.alert("Couldn't save list", e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPending(null);
    }
  };

  const onPrimary = () => (isEdit ? onSaveEdit(isDraftEdit ? 'publish' : 'save') : onCreate(false));
  const onSaveDraft = () => (isEdit ? onSaveEdit('draft') : onCreate(true));

  // Hold the form until the list loads in edit mode (cache is warm from the list
  // detail's useList — same query key — so this is usually instant).
  const editLoading = isEdit && !seeded;

  // The title/description fields and the "Items" header scroll ABOVE the rows; the
  // Save button sits below. They're passed to DragList as ELEMENTS (not inline
  // component types): a function component in ListHeaderComponent remounts on every
  // render, so the TextFields would drop focus/keyboard on each keystroke.
  const listHeader = (
    <View>
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
    </View>
  );

  const primaryLabel = !isEdit ? 'Create list' : isDraftEdit ? 'Publish' : 'Save changes';

  const listFooter = (
    <View style={{ marginTop: 24 }}>
      {showDraftActions ? (
        // Save draft (secondary) appears once there's content; primary
        // Create/Publish (needs a title) sits beside it.
        <View style={styles.footerRow}>
          {hasContent && (
            <View style={styles.footerBtn}>
              <Button label="Save draft" variant="secondary" onPress={onSaveDraft} disabled={busy} loading={pending === 'draft'} />
            </View>
          )}
          <View style={styles.footerBtn}>
            <Button label={primaryLabel} variant="primary" onPress={onPrimary} disabled={!titled || busy} loading={pending === 'main'} />
          </View>
        </View>
      ) : (
        <Button label={primaryLabel} variant="primary" onPress={onPrimary} disabled={!titled || busy} loading={pending === 'main'} />
      )}
    </View>
  );

  // One staged row: rank + poster + show/scope, then the ✕ remove and the ☰ grip.
  // Drag is initiated from the grip ONLY (onDragStart on its press-in / onDragEnd
  // on release), so the ✕ stays tappable and a future row-tap isn't hijacked.
  // `index` is the row's live position, so the rank reflects the order after a drop.
  // No "active" highlight: draglist flips isActive on press-IN (before any motion),
  // so an isActive-based style would flash the instant you touch the grip. The only
  // drag feedback is draglist's native finger-follow translate — smooth, no snap.
  const renderStaged = ({ item: s, index: i, onDragStart, onDragEnd }: DragListRenderItemInfo<Staged>) => {
    // Title = show name; sub-label = the scope. Whole-show rows say so explicitly;
    // scoped rows reuse the resolved scope title ("Season 2", "S01 · E05 ‘…’") so a
    // mixed-scope list is never ambiguous.
    const scopeLabel = s.season_number === null ? 'Whole show' : s.scopeTitle;
    return (
      <View style={styles.row}>
        <Text style={styles.stagedRank}>{i + 1}</Text>
        <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.showName} width={40} pressable={false} />
        <View style={styles.rowText}>
          <Text style={[type.creator, { color: colors.ink }]} numberOfLines={1}>{s.showName}</Text>
          <Text style={styles.scopeLabel} numberOfLines={1}>{scopeLabel}</Text>
        </View>
        <View style={styles.stagedControls}>
          <Pressable onPress={() => removeStaged(s.scopeKey)} hitSlop={6}>
            <CloseIcon color={colors.muted} size={18} />
          </Pressable>
          <Pressable
            onPressIn={onDragStart}
            onPressOut={onDragEnd}
            hitSlop={8}
            style={styles.dragHandle}
            accessibilityLabel={`Reorder ${s.showName}`}
          >
            <GripIcon color={colors.muted} size={22} />
          </Pressable>
        </View>
      </View>
    );
  };

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
        // Drag-to-reorder list. DragList IS the scroll container (it's a FlatList),
        // so the form fields ride in ListHeaderComponent and the Save button in
        // ListFooterComponent — you can't nest a FlatList inside a ScrollView on the
        // same axis without breaking the drag gesture + autoscroll.
        <DragList
          data={staged}
          keyExtractor={(s) => s.scopeKey}
          onReordered={onReordered}
          renderItem={renderStaged}
          ListHeaderComponent={listHeader}
          ListFooterComponent={listFooter}
          ListEmptyComponent={<Text style={styles.muted}>No items added yet.</Text>}
          // DragList wraps the FlatList in an outer View styled by `containerStyle`
          // (NOT `style`, which lands on the inner FlatList). Without flex:1 on that
          // wrapper it collapses to height 0 and the whole body renders blank.
          containerStyle={styles.list}
          style={styles.list}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        />
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
  list: { flex: 1 },
  body: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 40 },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  footerRow: { flexDirection: 'row', gap: 12 },
  footerBtn: { flex: 1 },
  sectionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  addItem: { fontFamily: fonts.semibold, fontSize: 14, color: colors.purple },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowText: { flex: 1 },
  scopeLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  stagedRank: { fontFamily: fonts.display, fontSize: 14, color: colors.muted, width: 18, textAlign: 'center' },
  stagedControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dragHandle: { padding: 2 },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingVertical: 16,
  },
});
