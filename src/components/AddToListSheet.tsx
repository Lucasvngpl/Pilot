import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useMyLists } from '@/api/useLists';
import { useListItemMutations } from '@/api/useListMutations';
import { Sheet } from '@/components/Sheet';
import { CheckIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Scope = { season_number: number | null; episode_number: number | null };
type Props = {
  visible: boolean;
  onClose: () => void;
  tmdbShowId: number;
  // The scope being added (defaults to the whole show). A season/episode scope
  // adds that exact item and the checkmarks reflect membership AT that scope.
  scope?: Scope;
};

// Stacks OVER the host sheet (sibling Sheets, the overlay convention). Toggling
// a list is optimistic: the check flips instantly and rolls back on failure.
export function AddToListSheet({
  visible, onClose, tmdbShowId, scope = { season_number: null, episode_number: null },
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const myId = user?.id;
  const { data: lists, isLoading } = useMyLists(myId);
  const listIds = (lists ?? []).map((l) => l.id);
  const { season_number, episode_number } = scope;
  const { data: serverMembership } = useMembership(tmdbShowId, season_number, episode_number, listIds);
  const { add, remove } = useListItemMutations();

  // Local optimistic copy of "which of my lists contain this show".
  const [membership, setMembership] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (serverMembership) setMembership(new Set(serverMembership));
  }, [serverMembership]);

  const toggle = async (listId: string) => {
    const has = membership.has(listId);
    setMembership((prev) => {
      const next = new Set(prev);
      if (has) next.delete(listId);
      else next.add(listId);
      return next;
    });
    try {
      if (has) await remove(listId, tmdbShowId, scope);
      else await add(listId, tmdbShowId, scope);
    } catch (e) {
      // Roll back the optimistic flip.
      setMembership((prev) => {
        const next = new Set(prev);
        if (has) next.add(listId);
        else next.delete(listId);
        return next;
      });
      Alert.alert("Couldn't update list", e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const onNewList = () => {
    onClose();
    // Carry the scope so the new list stages the season/episode, not the show.
    const scopeQ =
      (season_number != null ? `&season=${season_number}` : '') +
      (episode_number != null ? `&episode=${episode_number}` : '');
    router.push(`/list/new?showId=${tmdbShowId}${scopeQ}` as any);
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={420}>
      <Text style={styles.header}>Add to list</Text>

      <Pressable style={styles.newRow} onPress={onNewList}>
        <Text style={styles.newText}>+ New list</Text>
      </Pressable>
      <View style={styles.hairline} />

      {isLoading ? (
        <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
      ) : (lists ?? []).length === 0 ? (
        <Text style={styles.empty}>Create your first list above.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 280 }}>
          {(lists ?? []).map((l) => {
            const checked = membership.has(l.id);
            return (
              <Pressable key={l.id} style={styles.row} onPress={() => toggle(l.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={[type.reviewTitle, { color: colors.ink }]} numberOfLines={1}>{l.title}</Text>
                  <Text style={[type.filter, { color: colors.muted, marginTop: 1 }]}>
                    {l.itemCount} {l.itemCount === 1 ? 'show' : 'shows'}
                  </Text>
                </View>
                <View style={[styles.check, checked && styles.checkOn]}>
                  {checked && <CheckIcon color={colors.white} size={14} />}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Sheet>
  );
}

// Which of my lists already contain this scope (drives the checkmarks). Matches
// the EXACT scope — `.is(null)` vs `.eq(n)` per field — so the whole-show sheet
// doesn't tick lists that only hold one of its seasons/episodes, and vice versa.
function useMembership(
  tmdbShowId: number,
  season: number | null,
  episode: number | null,
  listIds: string[],
) {
  return useQuery<Set<string>>({
    queryKey: ['listMembership', tmdbShowId, season, episode, listIds],
    enabled: listIds.length > 0,
    queryFn: async () => {
      let q = supabase
        .from('list_items')
        .select('list_id')
        .eq('tmdb_show_id', tmdbShowId)
        .in('list_id', listIds);
      q = season === null ? q.is('season_number', null) : q.eq('season_number', season);
      q = episode === null ? q.is('episode_number', null) : q.eq('episode_number', episode);
      const { data, error } = await q;
      if (error) throw error;
      return new Set((data ?? []).map((r) => (r as { list_id: string }).list_id));
    },
  });
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  header: {
    fontFamily: type.subhead.fontFamily,
    fontSize: type.subhead.fontSize,
    color: colors.ink,
    paddingHorizontal: pad,
    paddingBottom: 12,
  },
  newRow: { paddingHorizontal: pad, paddingVertical: 14 },
  newText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.purple },
  hairline: { height: 1, backgroundColor: colors.hairline },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingVertical: 12, gap: 12 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.purple, borderColor: colors.purple },
  empty: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
