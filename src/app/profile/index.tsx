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
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { PosterGrid } from '@/components/PosterGrid';
import { DashedSlot } from '@/components/DashedSlot';
import { ShareIcon, GearIcon, ChevronRightIcon, CheckIcon } from '@/components/icons';
import { colors, type, pad } from '@/theme';
import type { CurrentlyWatchingCard } from '@/types';

const TOP_N = 4;  // four favorites fit one row with no horizontal scroll
const GAP = 10;

export default function Profile() {
  const { user, signOut } = useAuth();
  const userId = user?.id;

  const [tab, setTab] = useState<ProfileTabKey>('profile');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: profileData } = useProfile(userId);
  const { data: watching } = useCurrentlyWatching(userId);
  // Lazy: each grid only fetches once its tab has been opened (enabled flag).
  const { data: watched } = useWatchedShows(userId, tab === 'shows');
  const { data: watchlist } = useWatchlist(userId, tab === 'watchlist');

  // Anonymous users normally never reach /profile — BottomNav routes them to
  // /(auth) — but if they do (deep link, sign-out while here), bail gracefully.
  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.signedOut}>
          <Text style={[type.compactH, { color: colors.ink }]}>Profile</Text>
          <Text style={[type.reviewBody, styles.signedOutText]}>
            Log in to see your profile, watchlist, and the shows you&apos;ve tracked.
          </Text>
          <View style={styles.signedOutBtn}>
            <Button label="Log in" onPress={() => router.push('/(auth)')} />
          </View>
        </View>
        <BottomNav active="profile" />
      </SafeAreaView>
    );
  }

  const username =
    profileData?.profile?.username ?? user.email?.split('@')[0] ?? 'you';
  const avatarUrl = profileData?.profile?.avatar_url ?? null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Top action row: share (left), settings gear (right). */}
        <View style={styles.actionRow}>
          <Pressable hitSlop={8}>
            <ShareIcon color={colors.ink} size={22} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setSettingsOpen(true)}>
            <GearIcon color={colors.ink} size={22} />
          </Pressable>
        </View>

        {/* Identity: username + counts (left), avatar (right). */}
        <View style={styles.identity}>
          <View style={{ flex: 1 }}>
            <Text style={[type.compactH, { color: colors.ink, letterSpacing: -0.3 }]} numberOfLines={1}>
              {username}
            </Text>
            <View style={styles.counts}>
              <Text style={[type.countValue, { color: colors.ink }]}>{profileData?.following ?? 0}</Text>
              <Text style={[type.countLabel, { color: colors.muted, marginLeft: 4 }]}>Following</Text>
              <Text style={[type.countValue, { color: colors.ink, marginLeft: 16 }]}>{profileData?.followers ?? 0}</Text>
              <Text style={[type.countLabel, { color: colors.muted, marginLeft: 4 }]}>Followers</Text>
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

        {tab === 'profile' && <ProfileBody watching={watching ?? []} />}
        {tab === 'shows' && (
          <PosterGrid items={watched ?? []} emptyText="No watched shows yet." />
        )}
        {tab === 'lists' && (
          <Text style={styles.comingSoon}>Lists are coming soon.</Text>
        )}
        {tab === 'watchlist' && (
          <PosterGrid items={watchlist ?? []} emptyText="Your watchlist is empty." />
        )}
      </ScrollView>

      <BottomNav active="profile" />

      {/* Gear → settings sheet. Sign out lives here (room for more later). */}
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
    </SafeAreaView>
  );
}

// ----- Profile tab body -----------------------------------------------------

function ProfileBody({ watching }: { watching: CurrentlyWatchingCard[] }) {
  const { width: screenW } = useWindowDimensions();
  // Divide the content row into TOP_N slots + gaps (no horizontal scroll).
  const slotW = Math.floor((screenW - pad * 2 - GAP * (TOP_N - 1)) / TOP_N);

  return (
    <View>
      {/* Top 4 — edit flow is deferred (needs Search), so no "Edit" link yet
          rather than a dead control. Slots render empty for now. */}
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

      {/* `as any`: these routes exist (files below) but Expo Router's typed-route
          union only regenerates when Metro runs, so the literal isn't in the
          union yet at typecheck time. Same cast BottomNav/Tabs use. */}
      <View style={styles.links}>
        <LinkRow label="Diary" onPress={() => router.push('/profile/diary' as any)} />
        <LinkRow label="Following" onPress={() => router.push('/profile/following' as any)} />
        <LinkRow label="Followers" onPress={() => router.push('/profile/followers' as any)} />
      </View>
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

  signedOut: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: pad },
  signedOutText: { color: colors.muted, marginTop: 8, textAlign: 'center' },
  signedOutBtn: { marginTop: 20, alignSelf: 'stretch' },
});
