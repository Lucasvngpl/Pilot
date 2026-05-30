import { useState } from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/api/useProfile';
import { useCurrentlyWatching } from '@/api/useCurrentlyWatching';
import { useWatchedShows } from '@/api/useWatchedShows';
import { useWatchlist } from '@/api/useWatchlist';
import { Poster } from '@/components/Poster';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { BottomNav } from '@/components/BottomNav';
import { FollowButton } from '@/components/FollowButton';
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { PosterGrid } from '@/components/PosterGrid';
import { DashedSlot } from '@/components/DashedSlot';
import {
  ShareIcon, GearIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon,
} from '@/components/icons';
import { colors, type, pad } from '@/theme';
import type { CurrentlyWatchingCard } from '@/types';

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
  const { user, signOut } = useAuth();
  const myId = user?.id;
  const isOwn = variant === 'own';

  const [tab, setTab] = useState<ProfileTabKey>('profile');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: profileData } = useProfile(userId);
  const { data: watching } = useCurrentlyWatching(userId);
  // Lazy: each grid only fetches once its tab has been opened (enabled flag).
  const { data: watched } = useWatchedShows(userId, tab === 'shows');
  const { data: watchlist } = useWatchlist(userId, tab === 'watchlist');

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
              <Pressable hitSlop={8} onPress={() => setSettingsOpen(true)}>
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
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
          )}
        </View>

        <ProfileTabs
          active={tab}
          onChange={setTab}
          counts={{ shows: watched?.length, watchlist: watchlist?.length }}
        />

        {tab === 'profile' && <ProfileBody watching={watching ?? []} showDiary={isOwn} />}
        {tab === 'shows' && <PosterGrid items={watched ?? []} emptyText="No watched shows yet." />}
        {tab === 'lists' && <Text style={styles.comingSoon}>Lists are coming soon.</Text>}
        {tab === 'watchlist' && (
          <PosterGrid items={watchlist ?? []} emptyText="Nothing on the watchlist yet." />
        )}
      </ScrollView>

      {isOwn && <BottomNav active="profile" />}

      {isOwn && (
        <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} height={240}>
          <View style={styles.sheetBody}>
            <Text style={[type.subhead, { color: colors.ink, marginBottom: 16 }]}>Settings</Text>
            <Button
              label="Sign out"
              variant="secondary"
              onPress={() => {
                setSettingsOpen(false);
                signOut();
              }}
            />
          </View>
        </Sheet>
      )}
    </SafeAreaView>
  );
}

// ----- Profile tab body -----------------------------------------------------

function ProfileBody({
  watching,
  showDiary,
}: {
  watching: CurrentlyWatchingCard[];
  showDiary: boolean;
}) {
  const { width: screenW } = useWindowDimensions();
  const slotW = Math.floor((screenW - pad * 2 - GAP * (TOP_N - 1)) / TOP_N);

  return (
    <View>
      {/* Top 4 — edit flow deferred (needs Search), so no "Edit" link yet. */}
      <SectionHeader title="Your Top 4" />
      <View style={styles.topRow}>
        {Array.from({ length: TOP_N }).map((_, i) => (
          <DashedSlot key={i} n={i + 1} width={slotW} />
        ))}
      </View>

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

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={[type.profileSection, { color: colors.ink }]}>{title}</Text>
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

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    marginTop: 20,
  },
  topRow: { flexDirection: 'row', gap: GAP, paddingHorizontal: pad, marginTop: 12 },
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
});
