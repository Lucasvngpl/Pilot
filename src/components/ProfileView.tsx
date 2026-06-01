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
import { useDraftReviews } from '@/api/useMyReviews';
import { Poster } from '@/components/Poster';
import { Skeleton } from '@/components/Skeleton';
import { BottomNav } from '@/components/BottomNav';
import { FollowButton } from '@/components/FollowButton';
import { AvatarViewer } from '@/components/AvatarViewer';
import { ListCard } from '@/components/ListCard';
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { PosterGrid } from '@/components/PosterGrid';
import { DashedSlot } from '@/components/DashedSlot';
import { ProfileSkeleton } from '@/components/Skeletons';
import {
  ShareIcon, GearIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon,
  CalendarIcon, ReviewBadgeIcon, DraftIcon, SunIcon, MoonIcon,
} from '@/components/icons';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { CurrentlyWatchingCard, ShowCard, ListSummary } from '@/types';

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
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const myId = user?.id;
  const isOwn = variant === 'own';

  const [tab, setTab] = useState<ProfileTabKey>('profile');
  const [avatarOpen, setAvatarOpen] = useState(false);

  const { data: profileData, isLoading: profileLoading } = useProfile(userId);
  const { data: watching } = useCurrentlyWatching(userId);
  // Every Profile tab's data is fetched EAGERLY on mount (no tab gate), so once
  // the profile is open, switching between Shows / Lists / Watchlist is instant —
  // the queries are already in flight (or cached) before you tap a tab. Watchlist
  // and Lists used to be lazy (fetch-on-tab); we trade a little upfront work for
  // zero per-tab spinner.
  const { data: watched } = useWatchedShows(userId);
  const { data: watchlist } = useWatchlist(userId);
  const { data: topShows, isLoading: topLoading } = useTopShows(userId);
  const { data: lists, isLoading: listsLoading } = useMyLists(userId);
  // Drafts are OWN-ONLY — never fetch another user's. is_draft=true is NOT hidden
  // by RLS (see 0007), so passing undefined for other profiles keeps the query
  // disabled there; the Drafts row only renders on your own profile anyway.
  const { data: drafts } = useDraftReviews(isOwn ? userId : undefined);
  const draftCount = drafts?.length ?? 0;

  // Initial load → skeleton, so we don't flash empty fallbacks ("user", 0
  // counts, blank grids) before the profile data lands. Keep the nav affordance
  // (gear/share or back) live during the load.
  if (profileLoading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.actionRow}>
          {isOwn ? (
            <>
              <Pressable hitSlop={8}>
                <ShareIcon color={colors.ink} size={22} />
              </Pressable>
              {/* Right cluster: theme toggle sits just LEFT of the gear. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <ThemeToggle />
                <Pressable hitSlop={8} onPress={() => router.push('/settings' as any)}>
                  <GearIcon color={colors.ink} size={22} />
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable hitSlop={8} onPress={() => router.back()}>
              <ChevronLeftIcon color={colors.ink} size={24} />
            </Pressable>
          )}
        </View>
        <ProfileSkeleton />
        {isOwn && <BottomNav active="profile" />}
      </SafeAreaView>
    );
  }

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
  const displayName = profileData?.profile?.display_name ?? null;
  const name = displayName ?? username; // show the friendly name; fall back to the handle
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
              {/* Right cluster: theme toggle sits just LEFT of the gear. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
                <ThemeToggle />
                <Pressable hitSlop={8} onPress={() => router.push('/settings' as any)}>
                  <GearIcon color={colors.ink} size={22} />
                </Pressable>
              </View>
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

        {/* Identity: display name + @handle + tappable counts (left), avatar (right). */}
        <View style={styles.identity}>
          <View style={{ flex: 1 }}>
            <Text style={[type.compactH, { color: colors.ink, letterSpacing: -0.3 }]} numberOfLines={1}>
              {name}
            </Text>
            {displayName && (
              <Text style={[type.filter, { color: colors.muted, marginTop: 1 }]} numberOfLines={1}>
                @{username}
              </Text>
            )}
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
            topShows={topShows ?? []}
            topLoading={topLoading}
            isOwn={isOwn}
            draftCount={draftCount}
          />
        )}
        {tab === 'shows' && <PosterGrid items={watched ?? []} emptyText="No watched shows yet." />}
        {tab === 'lists' && <ListsBody lists={lists ?? []} isLoading={listsLoading} isOwn={isOwn} />}
        {tab === 'watchlist' && (
          <PosterGrid items={watchlist ?? []} emptyText="Nothing on the watchlist yet." />
        )}
      </ScrollView>

      {isOwn && <BottomNav active="profile" />}

      <AvatarViewer uri={avatarUrl} visible={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </SafeAreaView>
  );
}

// Header quick-flip between light/dark. Shows the OPPOSITE mode's icon (a moon in
// light → "go dark", a sun in dark → "go light"). Tapping sets an EXPLICIT manual
// preference; the 3-way System option lives in Settings › Appearance. Outline
// icon tinted `ink` (textPrimary) to match the share/gear icons it sits beside.
function ThemeToggle() {
  const { mode, setPref, colors } = useTheme();
  const isDark = mode === 'dark';
  return (
    <Pressable hitSlop={8} onPress={() => setPref(isDark ? 'light' : 'dark')}>
      {isDark ? <SunIcon color={colors.ink} size={22} /> : <MoonIcon color={colors.ink} size={22} />}
    </Pressable>
  );
}

// ----- Profile tab body -----------------------------------------------------

function ProfileBody({
  watching,
  topShows,
  topLoading,
  isOwn,
  draftCount,
}: {
  watching: CurrentlyWatchingCard[];
  topShows: ShowCard[];
  topLoading: boolean;
  isOwn: boolean;
  draftCount: number;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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
              ? // 4 fixed slots. Filled → poster. Still loading → a poster-shaped
                // skeleton (NOT the dashed "add" slot — otherwise a user WITH a
                // Top 4 sees empty numbered slots flash before their posters land).
                // Loaded + genuinely empty → the tappable dashed slot → editor.
                Array.from({ length: TOP_N }).map((_, i) => {
                  const show = topShows[i];
                  if (show) {
                    return (
                      <Poster
                        key={show.tmdb_show_id}
                        tmdbShowId={show.tmdb_show_id}
                        posterPath={show.poster_path}
                        name={show.name}
                        width={slotW}
                      />
                    );
                  }
                  if (topLoading) {
                    return <Skeleton key={`sk-${i}`} width={slotW} height={slotW * 1.5} radius={radius.md} />;
                  }
                  return (
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

      {/* "Your record" — the expressive / archive surfaces (Diary, Reviews; Stats
          later) grouped under one borderless headed section, beneath the showcase
          blocks above. Own-profile only: these are *your* activity surfaces. The
          Shows grid (a tab) stays the sole door to watched shows — deliberately no
          "Watched" row here, so nothing has two entry points. `as any`: typed-route
          union regenerates only when Metro runs. */}
      {isOwn && (
        <>
          <SectionHeader title="Your record" />
          <View style={styles.record}>
            <RecordRow
              icon={<CalendarIcon color={colors.ink} size={22} />}
              label="Diary"
              onPress={() => router.push('/profile/diary' as any)}
            />
            <RecordRow
              icon={<ReviewBadgeIcon color={colors.ink} size={20} />}
              label="Reviews"
              onPress={() => router.push('/profile/reviews' as any)}
            />
            <RecordRow
              icon={<DraftIcon color={colors.ink} size={22} />}
              label="Drafts"
              count={draftCount}
              onPress={() => router.push('/profile/drafts' as any)}
            />
          </View>
        </>
      )}
    </View>
  );
}

function WatchingCard({ card }: { card: CurrentlyWatchingCard }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHead}>
      <Text style={[type.profileSection, { color: colors.ink }]}>{title}</Text>
      {right}
    </View>
  );
}

// One borderless row in "Your record": leading icon · label · trailing chevron.
// No dividers between rows (clean Serializd-style list), generous height. Built
// to extend — Stats and other expressive surfaces drop in as more RecordRows.
function RecordRow({
  icon,
  label,
  count,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number; // optional badge (e.g. Drafts 2); hidden at 0
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.recordRow} onPress={onPress}>
      <View style={styles.recordIcon}>{icon}</View>
      <Text style={[type.reviewTitle, { color: colors.ink, flex: 1 }]}>{label}</Text>
      {count != null && count > 0 && (
        <View style={styles.recordBadge}>
          <Text style={styles.recordBadgeText}>{count}</Text>
        </View>
      )}
      <ChevronRightIcon color={colors.faint} size={20} />
    </Pressable>
  );
}

// Lists tab body. Data is fetched eagerly by ProfileView (so the tab is instant)
// and passed in — this just renders it (+ the owner's "New list" row).
function ListsBody({
  lists,
  isLoading,
  isOwn,
}: {
  lists: ListSummary[];
  isLoading: boolean;
  isOwn: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const items = lists;
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

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

  // "Your record" — borderless rows (no dividers), generous height.
  record: { marginTop: 4 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: pad,
    paddingVertical: 16,
  },
  recordIcon: { width: 24, alignItems: 'center' },
  recordBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    paddingHorizontal: 7, marginRight: 6,
    backgroundColor: colors.field, alignItems: 'center', justifyContent: 'center',
  },
  recordBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },

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
