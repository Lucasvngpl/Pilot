import { useState, useEffect } from 'react';
import {
  View, Text, Pressable, StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DragList, { type DragListRenderItemInfo } from 'react-native-draglist';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { useSuppressBackSwipe } from '@/lib/sheetGesture';
import { useAuth } from '@/lib/auth';
import { useTopShows } from '@/api/useTopShows';
import { useSetTopShows } from '@/api/useSetTopShows';
import { useSearchShows } from '@/api/useSearchShows';
import { useDebounce } from '@/lib/useDebounce';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/Button';
import { Poster } from '@/components/Poster';
import { SearchResultRowsSkeleton } from '@/components/Skeletons';
import { ChevronLeftIcon, CloseIcon, GripIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { SearchShowResult } from '@/types';

const MAX = 4;

type Staged = { tmdb_show_id: number; name: string; poster_path: string | null };

// Edit screen for the Profile "Your Top 4". Drag the ☰ grip to reorder (same
// react-native-draglist pattern as the list editor, list/new.tsx) — slot numbers
// reflect the live order, written to `position` on Save. Reuses the /list/new
// picker pattern (search → "+" to stage → removable rows).
export default function TopShowsEdit() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const myId = user?.id;
  const { data: existing } = useTopShows(myId);
  const { save, isPending } = useSetTopShows();

  // DragList (react-native-gesture-handler) swallows the screen's native iOS
  // edge-swipe-back, so without this you can't swipe back out of the editor
  // (PIL-7). Same fix as list/new.tsx: drop the (dead) native gesture and
  // provide our own left-edge back-swipe.
  useSuppressBackSwipe(true);
  const backSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(20)
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      const startX = e.absoluteX - e.translationX;
      if (startX < 40 && e.translationX > 60) router.back();
    });

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

  // Drag-to-reorder (react-native-draglist hands us the row's start + drop index).
  // Pull the row out and reinsert it at the drop point — the staged order IS the
  // slot order, written to profile_top_shows.position on Save.
  const onReordered = (fromIndex: number, toIndex: number) =>
    setStaged((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

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

  // One staged row: slot number + poster + name, then the ✕ remove and the ☰
  // grip. Drag starts from the grip ONLY (onDragStart on press-in / onDragEnd on
  // release) so the ✕ stays tappable. `index` is the row's live position, so the
  // slot number reflects the order after a drop.
  const renderStaged = ({ item: s, index: i, onDragStart, onDragEnd }: DragListRenderItemInfo<Staged>) => (
    <View style={styles.row}>
      <Text style={styles.slotNum}>{i + 1}</Text>
      <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.name} width={40} pressable={false} />
      <Text style={[type.creator, { color: colors.ink, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
      <View style={styles.stagedControls}>
        <Pressable onPress={() => removeStaged(s.tmdb_show_id)} hitSlop={6}>
          <CloseIcon color={colors.muted} size={18} />
        </Pressable>
        <Pressable
          onPressIn={onDragStart}
          onPressOut={onDragEnd}
          hitSlop={8}
          style={styles.dragHandle}
          accessibilityLabel={`Reorder ${s.name}`}
        >
          <GripIcon color={colors.muted} size={22} />
        </Pressable>
      </View>
    </View>
  );

  // Header/footer are passed as ELEMENTS (not inline component types) so the
  // SearchInput doesn't drop focus/keyboard on each keystroke — see list/new.tsx.
  const listHeader = (
    <Text style={styles.sectionLabel}>Favorites{staged.length > 0 ? ` (${staged.length}/${MAX})` : ''}</Text>
  );

  const listFooter = (
    <View>
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
    </View>
  );

  return (
    <GestureDetector gesture={backSwipe}>
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Your Top 4</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* DragList IS the scroll container (it's a FlatList) — the "Favorites"
          label rides in ListHeaderComponent and the search/Save UI in
          ListFooterComponent, same split as list/new.tsx. */}
      <DragList
        data={staged}
        keyExtractor={(s) => String(s.tmdb_show_id)}
        onReordered={onReordered}
        renderItem={renderStaged}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={<Text style={styles.muted}>No favorites yet — search below to add up to {MAX}.</Text>}
        containerStyle={styles.list}
        style={styles.list}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
    </GestureDetector>
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
  sectionLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  slotNum: { fontFamily: fonts.bold, fontSize: 15, color: colors.muted, width: 14, textAlign: 'center' },
  plus: { fontFamily: fonts.bold, fontSize: 22, color: colors.purple, paddingHorizontal: 4 },
  stagedControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dragHandle: { padding: 2 },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingVertical: 16,
  },
});
