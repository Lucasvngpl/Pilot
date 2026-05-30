import { ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useList } from '@/api/useLists';
import { useDeleteList } from '@/api/useListMutations';
import { PosterGrid } from '@/components/PosterGrid';
import { ChevronLeftIcon } from '@/components/icons';
import { colors, type, pad } from '@/theme';

export default function ListDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data: list, isLoading, isError } = useList(id);
  const { remove, isPending } = useDeleteList();

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
          <Pressable onPress={onDelete} hitSlop={8} disabled={isPending}>
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
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
  delete: { fontFamily: type.reviewUser.fontFamily, fontSize: 14, color: colors.red },
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
