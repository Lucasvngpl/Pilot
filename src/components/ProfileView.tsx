import { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/api/useProfile';
import { useCurrentlyWatching } from '@/api/useCurrentlyWatching';
import { useWatchedShows } from '@/api/useWatchedShows';
import { useWatchlist } from '@/api/useWatchlist';
import { useMyLists } from '@/api/useLists';
import { useTopShows } from '@/api/useTopShows';
import { Poster } from '@/components/Poster';
import { BottomNav } from '@/components/BottomNav';
import { FollowButton } from '@/components/FollowButton';
import { AvatarViewer } from '@/components/AvatarViewer';
import { ListCard } from '@/components/ListCard';
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { PosterGrid } from '@/components/PosterGrid';
import { DashedSlot } from '@/components/DashedSlot';
import {
  ShareIcon, GearIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon,
} from '@/components/icons';
import { colors, type, pad, fonts } from '@/theme';
import type { CurrentlyWatchingCard, ShowCard } from '@/types';

const TOP_N = 4; // four favorites fit one row with no horizontal scroll
const GAP = 10;

type Variant = 'own' | 'other';

/**
 * Shared profile body for BOTH /profile (own) and /user/[id] (other). The data
 * hooks already take a `userId`, so only the chrome differs by `variant`:
 *  - own:   share + gear → sign-out sheet, BottomNav, Diary link, no Follow button.
 *  - other: back button, Follow button (when not yourself), no sheet/nav/Diary.
 */
export function ProfileView({ userId, variant }: { userId: string; variant: Variant }) {
  const { user } = useAuth();
  const myId = user?.id;
  const isOwn = variant === 'own';

  const [tab, setTab] = useState<ProfileTabKey>('profile');
  const [avatarOpen, setAvatarOpen] = useState(false);

  const { data: profileData } = useProfile(userId);
  const { data: watching } = useCurrentlyWatching(userId);
  // Shows is prefetched on mount (no tab gate) so switching to it is instant —
  // it's the primary "what I've watched" grid. Watchlist stays lazy.
  const { data: watched } = useWatchedShows(userId);
  const { data: watchlist } = useWatchlist(userId, tab === 'watchlist');
  // Top-4 is on the default Profile tab, so fetch eagerly (like watched).
  const { data: topShows } = useTopShows(userId);

  // Other-user profile that doesn't exist → friendly not-found (back only).
  if (!isOwn && profileData && !profileData.profile) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.actionRow}>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <ChevronLeftIcon color={colors.ink} size={24} />
          </Pressable>
          <View />
        </View>
        <View style={styles.centerBody}>
          <Text style={[type.reviewBody, { color: colors.muted }]}>User not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const username =
    profileData?.profile?.username ??
    (isOwn ? user?.email?.split('@')[0] : undefined) ??
    'user';
  const avatarUrl = profileData?.profile?.avatar_url ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: isOwn ? 120 : 32 }}>
        {/* Top action row — differs by variant. */}
        <View style={styles.actionRow}>
          {isOwn ? (
            <>
              <Pressable hitSlop={8}>
                <ShareIcon color={colors.ink} size={22} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => router.push('/settings' as any)}>
                <GearIcon color={colors.ink} size={22} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable hitSlop={8} onPress={() => router.back()}>
                <ChevronLeftIcon color={colors.ink} size={24} />
              </Pressable>
              {/* No follow-yourself button. */}
              {myId !== userId ? <FollowButton followeeId={userId} /> : <View />}
            </>
          )}
        </View>

        {/* Identity: username + tappable counts (left), avatar (right). */}
        <View style={styles.identity}>
          <View style={{ flex: 1 }}>
            <Text style={[type.compactH, { color: colors.ink, letterSpacing: -0.3 }]} numberOfLines={1}>
              {username}
            </Text>
            <View style={styles.counts}>
              <Pressable
                style={styles.countGroup}
                hitSlop={6}
                onPress={() => router.push(`/user/${userId}/following` as any)}
              >
                <Text style={[type.countValue, { color: colors.ink }]}>{profileData?.following ?? 0}</Text>
                <Text style={[type.countLabel, { color: colors.muted, marginLeft: 4 }]}>Following</Text>
              </Pressable>
              <Pressable
                style={[styles.countGroup, { marginLeft: 16 }]}
                hitSlop={6}
                onPress={() => router.push(`/user/${userId}/followers` as any)}
              >
                <Text style={[type.countValue, { color: colors.ink }]}>{profileData?.followers ?? 0}</Text>
                <Text style={[type.countLabel, { color: colors.muted, marginLeft: 4 }]}>Followers</Text>
              </Pressable>
            </View>
          </View>
          {avatarUrl ? (
            <Pressable onPress={() => setAvatarOpen(true)}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </Pressable>
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
          )}
        </View>

        {profileData?.profile?.bio ? (
          <Text style={styles.bio}>{profileData.profile.bio}</Text>
        ) : null}

        <ProfileTabs
          active={tab}
          onChange={setTab}
          counts={{ shows: watched?.length, watchlist: watchlist?.length }}
        />

        {tab === 'profile' && (
          <ProfileBody
            watching={watching ?? []}
            showDiary={isOwn}
            topShows={topShows ?? []}
            isOwn={isOwn}
          />
        )}
        {tab === 'shows' && <PosterGrid items={watched ?? []} emptyText="No watched shows yet." />}
        {tab === 'lists' && <ListsBody userId={userId} isOwn={isOwn} />}
        {tab === 'watchlist' && (
          <PosterGrid items={watchlist ?? []} emptyText="Nothing on the watchlist yet." />
        )}
      </ScrollView>

      {isOwn && <BottomNav active="profile" />}

      <AvatarViewer uri={avatarUrl} visible={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </SafeAreaView>
  );
}

// ----- Profile tab body -----------------------------------------------------

function ProfileBody({
  watching,
  showDiary,
  topShows,
  isOwn,
}: {
  watching: CurrentlyWatchingCard[];
  showDiary: boolean;
  topShows: ShowCard[];
  isOwn: boolean;
}) {
  const { width: screenW } = useWindowDimensions();
  const slotW = Math.floor((screenW - pad * 2 - GAP * (TOP_N - 1)) / TOP_N);

  // Own profile: always show the 4-slot grid (empty slots are the "add" affordance).
  // Another user: only show their favorites if they have any — never empty slots
  // on someone else's profile.
  const showTop4 = isOwn || topShows.length > 0;

  return (
    <View>
      {showTop4 && (
        <>
          <SectionHeader
            title="Your Top 4"
            right={
              isOwn ? (
                <Pressable hitSlop={8} onPress={() => router.push('/profile/top-shows' as any)}>
                  <Text style={styles.editLink}>Edit</Text>
                </Pressable>
              ) : undefined
            }
          />
          <View style={styles.topRow}>
            {isOwn
              ? // 4 fixed slots: poster if filled, else a tappable dashed slot → editor.
                Array.from({ length: TOP_N }).map((_, i) => {
                  const show = topShows[i];
                  return show ? (
                    <Poster
                      key={show.tmdb_show_id}
                      tmdbShowId={show.tmdb_show_id}
                      posterPath={show.poster_path}
                      name={show.name}
                      width={slotW}
                    />
                  ) : (
                    <Pressable key={`slot-${i}`} onPress={() => router.push('/profile/top-shows' as any)}>
                      <DashedSlot n={i + 1} width={slotW} />
                    </Pressable>
                  );
                })
              : // Other user: just their favorites, no dashed fillers.
                topShows.map((show) => (
                  <Poster
                    key={show.tmdb_show_id}
                    tmdbShowId={show.tmdb_show_id}
                    posterPath={show.poster_path}
                    name={show.name}
                    width={slotW}
                  />
                ))}
          </View>
        </>
      )}

      <SectionHeader title="Currently watching" />
      {watching.length === 0 ? (
        <Text style={styles.emptyInline}>Nothing in progress right now.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
          {watching.map((w) => (
            <WatchingCard key={w.tmdb_show_id} card={w} />
          ))}
        </ScrollView>
      )}

      {/* Following/Followers now live on the tappable identity counts. Diary is
          own-only and still a stub. `as any`: typed-route union regenerates only
          when Metro runs. */}
      {showDiary && (
        <View style={styles.links}>
          <LinkRow label="Diary" onPress={() => router.push('/profile/diary' as any)} />
        </View>
      )}
    </View>
  );
}

function WatchingCard({ card }: { card: CurrentlyWatchingCard }) {
  return (
    <View style={{ width: 112 }}>
      <View>
        <Poster tmdbShowId={card.tmdb_show_id} posterPath={card.poster_path} name={card.name} width={112} />
        {/* Watched-check overlay. pointerEvents:'none' so taps fall through to
            the Poster's own press → /show/[id]. */}
        <View style={styles.checkBubble}>
          <CheckIcon color={colors.white} size={12} />
        </View>
      </View>
      <Text style={[type.reviewUser, { color: colors.ink, marginTop: 6 }]} numberOfLines={1}>
        {card.name}
      </Text>
      {card.episodeLine && (
        <Text style={[type.epRuntime, { color: colors.muted, marginTop: 1 }]}>{card.episodeLine}</Text>
      )}
    </View>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={[type.profileSection, { color: colors.ink }]}>{title}</Text>
      {right}
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.linkRow} onPress={onPress}>
      <Text style={[type.reviewTitle, { color: colors.ink }]}>{label}</Text>
      <ChevronRightIcon color={colors.faint} size={20} />
    </Pressable>
  );
}

function ListsBody({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const { data: lists, isLoading } = useMyLists(userId);
  const items = lists ?? [];
  return (
    <View style={{ paddingTop: 4 }}>
      {isOwn && (
        <Pressable style={styles.newListRow} onPress={() => router.push('/list/new' as any)}>
          <Text style={[type.reviewTitle, { color: colors.purple }]}>+ New list</Text>
        </Pressable>
      )}
      {isLoading ? (
        <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
      ) : items.length === 0 ? (
        <Text style={styles.emptyInline}>{isOwn ? 'No lists yet.' : 'No lists.'}</Text>
      ) : (
        items.map((l) => <ListCard key={l.id} list={l} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },

  actionRow: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pad,
    paddingBottom: 16,
  },
  counts: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  countGroup: { flexDirection: 'row', alignItems: 'baseline' },
  avatar: { width: 72, height: 72, borderRadius: 36, marginLeft: 12 },
  bio: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.ink,
    lineHeight: 20,
    paddingHorizontal: pad,
    marginTop: -4,
    marginBottom: 16,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    marginTop: 20,
  },
  topRow: { flexDirection: 'row', gap: GAP, paddingHorizontal: pad, marginTop: 12 },
  editLink: { fontFamily: fonts.semibold, fontSize: 14, color: colors.purple },
  shelf: { gap: 12, paddingHorizontal: pad, paddingTop: 12 },
  checkBubble: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },

  links: { marginTop: 24, borderTopWidth: 1, borderTopColor: colors.hairline },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },

  comingSoon: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 28,
  },
  emptyInline: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingHorizontal: pad,
    paddingTop: 12,
  },

  sheetBody: { paddingHorizontal: pad },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: pad },
  newListRow: {
    paddingHorizontal: pad,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
});
