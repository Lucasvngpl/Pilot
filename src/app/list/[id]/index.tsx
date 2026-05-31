// /list/[id] — list detail: title, description, show count, and a poster grid; owner gets an edit/delete ⋯ menu.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useList } from '@/api/useLists';
import { useDeleteList } from '@/api/useListMutations';
import { PosterGrid } from '@/components/PosterGrid';
import { Skeleton } from '@/components/Skeleton';
import { PosterGridSkeleton } from '@/components/Skeletons';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { ChevronLeftIcon, DotsIcon } from '@/components/icons';
import { colors, type, pad } from '@/theme';

export default function ListDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: list, isLoading, isError } = useList(id);
  const { remove, isPending } = useDeleteList();
  const [menuOpen, setMenuOpen] = useState(false);

  const isOwner = !!user && !!list && list.user_id === user.id;

  const onDelete = () => {
    if (!list) return;
    Alert.alert('Delete list?', `"${list.title}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(list.id);
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {isOwner && (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} disabled={isPending}>
            <DotsIcon color={colors.ink} size={20} />
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View>
          <View style={styles.header}>
            <Skeleton width={200} height={26} />
            <Skeleton width={120} height={13} style={{ marginTop: 8 }} />
            <Skeleton width={70} height={13} style={{ marginTop: 10 }} />
          </View>
          <PosterGridSkeleton />
        </View>
      ) : isError || !list ? (
        <Text style={styles.muted}>List not found.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.header}>
            <Text style={[type.compactH, { color: colors.ink }]}>{list.title}</Text>
            {list.ownerUsername && (
              <Text style={[type.filter, { color: colors.muted, marginTop: 4 }]}>by {list.ownerUsername}</Text>
            )}
            {list.description ? <Text style={styles.desc}>{list.description}</Text> : null}
            <Text style={[type.filter, { color: colors.faint, marginTop: 8 }]}>
              {list.items.length} {list.items.length === 1 ? 'show' : 'shows'}
            </Text>
          </View>
          {list.items.length === 0 ? (
            <Text style={styles.muted}>This list is empty.</Text>
          ) : (
            <PosterGrid items={list.items} emptyText="" />
          )}
        </ScrollView>
      )}

      {/* Owner-only Edit/Delete menu. */}
      <ActionMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: 'Edit list', onPress: () => router.push(`/list/new?edit=${id}` as any) },
          { label: 'Delete list', destructive: true, onPress: onDelete },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  header: { paddingHorizontal: pad, paddingTop: 8, paddingBottom: 4 },
  desc: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.ink,
    lineHeight: 20,
    marginTop: 8,
  },
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 28,
  },
});
