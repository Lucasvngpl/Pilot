// /profile/drafts — the signed-in user's UNPUBLISHED review drafts: the ONE place a draft surfaces. Tap → composer (edit) to keep writing / Save draft / Publish.
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useDraftReviews } from '@/api/useMyReviews';
import { useDraftLists } from '@/api/useLists';
import { useProfile } from '@/api/useProfile';
import { useDeleteReview } from '@/api/useReviewMutations';
import { ReviewRow } from '@/components/ReviewRow';
import { ListCard } from '@/components/ListCard';
import { ReviewRowsSkeleton } from '@/components/Skeletons';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope, type MyReviewEntry } from '@/types';

// IMPORTANT: useDraftReviews must only ever run for the SIGNED-IN user (it's
// is_draft=true, and RLS does NOT hide drafts from others — see 0007). The row
// that links here is own-only, and we pass our own user.id.
export default function Drafts() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data: drafts, isLoading } = useDraftReviews(user?.id);
  const { data: listDrafts } = useDraftLists(user?.id);
  const { data: myProfile } = useProfile(user?.id);
  const { remove } = useDeleteReview();
  const [menuDraft, setMenuDraft] = useState<MyReviewEntry | null>(null);

  const profile = myProfile?.profile;
  const username = profile?.username ?? user?.email?.split('@')[0] ?? 'you';

  const openComposer = (d: MyReviewEntry) =>
    router.push(`/show/${d.tmdb_show_id}/review?reviewId=${d.id}` as any);

  const confirmDelete = (d: MyReviewEntry) => {
    Alert.alert('Delete draft?', 'This permanently deletes this draft.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(d.id, d.tmdb_show_id);
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
        <Text style={[type.subhead, { color: colors.ink }]}>Drafts</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ReviewRowsSkeleton />
      ) : (drafts?.length ?? 0) === 0 && (listDrafts?.length ?? 0) === 0 ? (
        <Text style={styles.empty}>No drafts.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* List drafts — tap opens the composer (edit), not the public detail. */}
          {(listDrafts ?? []).map((l) => (
            <ListCard key={`list:${l.id}`} list={l} onPress={() => router.push(`/list/new?edit=${l.id}` as any)} />
          ))}
          {(drafts ?? []).map((d) => (
            // Tapping the body opens the composer (continue editing) — drafts go
            // there, NOT to the public /review page. The ⋯ menu claims its own tap.
            <ReviewRow
              key={d.id}
              username={username}
              displayName={profile?.display_name}
              avatarUri={profile?.avatar_url ?? undefined}
              showTitle={d.showName}
              seasonLine={formatScope(d.season_number, d.episode_number)}
              rating={d.rating ?? 0}
              body={d.body || 'No text yet — tap to keep writing.'}
              containsSpoilers={d.contains_spoilers}
              likes={d.likes}
              tmdbShowId={d.tmdb_show_id}
              posterPath={d.posterPath}
              onPress={() => openComposer(d)}
              onMenu={() => setMenuDraft(d)}
            />
          ))}
        </ScrollView>
      )}

      <ActionMenuSheet
        visible={!!menuDraft}
        onClose={() => setMenuDraft(null)}
        actions={
          menuDraft
            ? [
                { label: 'Edit draft', onPress: () => openComposer(menuDraft) },
                { label: 'Delete draft', destructive: true, onPress: () => confirmDelete(menuDraft) },
              ]
            : []
        }
      />
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
  empty: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 40,
  },
});
