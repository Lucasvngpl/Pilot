// /list/[id] — list detail: auto-banner (posters composite) + creator identity +
// numbered, position-ranked rows; owner gets edit/delete via the banner ⋯. The
// banner is the first item INSIDE the ScrollView, so it covers the top like a
// hero on load but scrolls away with the rest of the content (PIL-19).
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useList } from '@/api/useLists';
import { useDeleteList } from '@/api/useListMutations';
import { Poster } from '@/components/Poster';
import { ListBanner } from '@/components/ListBanner';
import { Markdown } from '@/components/Markdown';
import { Skeleton } from '@/components/Skeleton';
import { ContentActionSheet } from '@/components/ContentActionSheet';
import { CommentsSection } from '@/components/CommentsSection';
import { ChevronLeftIcon, DotsIcon, ShareIcon } from '@/components/icons';
import { ListLikeBar } from '@/components/LikeBar';
import { shareList } from '@/lib/share';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { ListDetail, ListShowItem } from '@/types';

export default function ListDetailScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: list, isLoading, isError } = useList(id);
  const { remove, isPending } = useDeleteList();
  const [menuOpen, setMenuOpen] = useState(false);

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

  // White controls over the banner — back (always), Share (anyone, once the list
  // loads), and ⋯ (once loaded → owner: Change banner/Edit/Delete; others:
  // Report/Block — ContentActionSheet decides). Padded below the notch since the
  // banner is full-bleed under the status bar.
  const controls = (l: ListDetail | null | undefined) => {
    return (
      <View style={[styles.controls, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.controlBtn}>
          <ChevronLeftIcon color={colors.white} size={26} />
        </Pressable>
        <View style={styles.controlsRight}>
          {l && (
            <Pressable onPress={() => shareList(l)} hitSlop={10} style={styles.controlBtn}>
              <ShareIcon color={colors.white} size={22} />
            </Pressable>
          )}
          {l && (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.controlBtn} disabled={isPending}>
              <DotsIcon color={colors.white} size={22} />
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const bannerHeight = 132 + insets.top;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
          <ListBanner posters={[]} height={bannerHeight}>{controls(undefined)}</ListBanner>
          <View style={styles.header}>
            <Skeleton width={200} height={26} />
            <Skeleton width={130} height={14} style={{ marginTop: 12 }} />
          </View>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.rankRow}>
              <Skeleton width={18} height={20} />
              <Skeleton width={44} height={66} radius={radius.md} />
              <View style={styles.rankText}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  }

  // A draft has no public detail — it's reached only via the owner's Drafts →
  // composer. Hide it from anyone who isn't the owner (belt-and-suspenders; drafts
  // have no public entry point anyway).
  const draftHidden = !!list && list.is_draft && list.user_id !== user?.id;

  if (isError || !list || draftHidden) {
    return (
      <View style={styles.screen}>
        <StatusBar style="light" />
        <ListBanner posters={[]} height={bannerHeight}>{controls(undefined)}</ListBanner>
        <Text style={styles.muted}>List not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* White status-bar icons over the dark banner. The banner is the first
          ScrollView child, so it's at the very top under the status bar on
          load (light content is right), and scrolls away with everything
          else below it. */}
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
        // iOS: lift content above the keyboard so the comment composer isn't covered.
        automaticallyAdjustKeyboardInsets
      >
        <ListBanner
          posters={list.items.map((it) => it.poster_path)}
          bannerUrl={list.bannerUrl}
          height={bannerHeight}
        >
          {controls(list)}
        </ListBanner>

        <View style={styles.header}>
          <Text style={[type.compactH, { color: colors.ink }]}>{list.title}</Text>

          {/* Creator identity — avatar + "by @handle" (handle in purple); the whole
              row routes to the creator's profile. */}
          {list.ownerUsername && (
            <Pressable
              style={styles.creator}
              hitSlop={6}
              onPress={() => router.push(`/user/${list.user_id}` as any)}
            >
              {list.ownerAvatarUrl ? (
                <Image source={{ uri: list.ownerAvatarUrl }} style={styles.creatorAvatar} />
              ) : (
                <View style={[styles.creatorAvatar, { backgroundColor: colors.hairline }]} />
              )}
              <Text style={styles.creatorText}>
                by <Text style={styles.creatorName}>@{list.ownerUsername}</Text>
              </Text>
            </Pressable>
          )}

          {list.description ? <Markdown text={list.description} style={styles.desc} /> : null}
          <Text style={styles.count}>
            {list.items.length} {list.items.length === 1 ? 'show' : 'shows'} · {formatCreated(list.createdAt)}
          </Text>

          {/* Interactive like bar — tap the heart to toggle; shows liker avatars +
              count. (list_likes / migration 0010.) */}
          <View style={styles.likes}>
            <ListLikeBar listId={list.id} size={15} />
          </View>
        </View>

        {list.items.length === 0 ? (
          <Text style={styles.muted}>This list is empty.</Text>
        ) : (
          // Strictly in position order (useList orders by position, then added_at),
          // so the rank is just the row's 1-based index — stable across reloads.
          list.items.map((item, i) => <RankedRow key={item.scopeKey} rank={i + 1} item={item} />)
        )}

        {/* Flat comment thread + composer (public read, login-gated post). */}
        <CommentsSection targetType="list" targetId={list.id} />
      </ScrollView>

      {/* Banner ⋯ menu. Owner → Change banner / Edit / Delete; others →
          Report list / Block user. After a block, leave the page (now hidden). */}
      <ContentActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        target={{ type: 'list', id: list.id, userId: list.user_id }}
        ownActions={[
          { label: 'Change banner', onPress: () => router.push(`/list/${id}/banner` as any) },
          { label: 'Edit list', onPress: () => router.push(`/list/new?edit=${id}` as any) },
          { label: 'Delete list', destructive: true, onPress: onDelete },
        ]}
        onBlocked={() => router.back()}
      />

    </View>
  );
}

function RankedRow({ rank, item }: { rank: number; item: ListShowItem }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Title = the SHOW; subtitle = scope (only when this row is a season/episode) + meta.
  // `item.name` is the RESOLVED scope title ("Season 2" / "S01 · E04 'Who Goes There?'")
  // — for a whole-show row it equals the show name, so we drop it there to avoid the
  // redundant "True Detective / True Detective · HBO". Without this the show was
  // invisible on a mixed list (you couldn't tell which show an episode belonged to).
  const scopeLabel = item.season_number === null ? null : item.name;
  const subtitle = [scopeLabel, item.network, item.year].filter(Boolean).join(' · ');
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <Poster
        tmdbShowId={item.tmdb_show_id}
        posterPath={item.poster_path}
        name={item.showName}
        width={44}
        // A list row can be a season/episode — route the poster to that scope (PIL-6).
        seasonNumber={item.season_number}
        episodeNumber={item.episode_number}
      />
      <View style={styles.rankText}>
        <Text style={[type.reviewTitle, { color: colors.ink }]} numberOfLines={1}>
          {item.showName}
        </Text>
        {subtitle ? (
          <Text style={[type.filter, { color: colors.muted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// lists.created_at (a full timestamp) → "May 31, 2026". Manual format rather than
// toLocaleDateString(opts) — Hermes' Intl can ignore the options and hand back a
// numeric date. The timestamp carries a time, so new Date() is unambiguous here.
function formatCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
  },
  controlBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  controlsRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  header: { paddingHorizontal: pad, paddingTop: 16, paddingBottom: 8 },
  creator: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  creatorAvatar: { width: 24, height: 24, borderRadius: 12 },
  creatorText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  creatorName: { fontFamily: fonts.semibold, color: colors.purple },
  desc: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.ink,
    lineHeight: 20,
    marginTop: 10,
  },
  count: { fontFamily: type.filter.fontFamily, fontSize: type.filter.fontSize, color: colors.faint, marginTop: 8 },
  likes: { marginTop: 14 },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 8 },
  rankNum: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, width: 22, textAlign: 'center' },
  rankText: { flex: 1 },

  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 28,
  },
});
