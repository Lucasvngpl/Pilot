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
import { useWatchedShows, type WatchedFilter } from '@/api/useWatchedShows';
import { useShowsFilter } from '@/lib/showsFilterPref';
import { useWatchlist } from '@/api/useWatchlist';
import { useMyLists, useDraftLists } from '@/api/useLists';
import { useTopShows } from '@/api/useTopShows';
import { useDraftReviews } from '@/api/useMyReviews';
import { Poster } from '@/components/Poster';
import { Markdown } from '@/components/Markdown';
import { Skeleton } from '@/components/Skeleton';
import { FollowButton } from '@/components/FollowButton';
import { AvatarViewer } from '@/components/AvatarViewer';
import { ListCard } from '@/components/ListCard';
import { ProfileTabs, type ProfileTabKey } from '@/components/ProfileTabs';
import { PosterGrid } from '@/components/PosterGrid';
import { DashedSlot } from '@/components/DashedSlot';
import { ProfileSkeleton, PosterGridSkeleton, ListCardsSkeleton } from '@/components/Skeletons';
import {
  ShareIcon, GearIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon,
  CalendarIcon, ReviewBadgeIcon, DraftIcon, HeartIcon, SunIcon, MoonIcon,
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
  const [showsFilter, setShowsFilter] = useShowsFilter(); // Shows-tab segment, persisted
  const [avatarOpen, setAvatarOpen] = useState(false);

  const { data: profileData, isLoading: profileLoading } = useProfile(userId);
  const { data: watching } = useCurrentlyWatching(userId);
  // Every Profile tab's data is fetched EAGERLY on mount (no tab gate), so once
  // the profile is open, switching between Shows / Lists / Watchlist is instant —
  // the queries are already in flight (or cached) before you tap a tab. Watchlist
  // and Lists used to be lazy (fetch-on-tab); we trade a little upfront work for
  // zero per-tab spinner.
  // Two reads, deduped by React Query when the filter is 'watched' (one fetch):
  //  - watchedShows: the fixed 'watched' set → the tab badge + "Your record" count.
  //  - gridShows:    the active filter → what the Shows grid renders.
  const { data: watchedShows } = useWatchedShows(userId, 'watched');
  // gridLoading is true only while an UNCACHED filter is fetching (switching to a
  // not-yet-loaded segment). Switching back to a cached one is instant (false),
  // so we show the skeleton on the genuine load, never on the empty result.
  const { data: gridShows, isLoading: gridLoading } = useWatchedShows(userId, showsFilter);
  const watchedCount = watchedShows?.length ?? 0;
  const { data: watchlist } = useWatchlist(userId);
  const { data: topShows, isLoading: topLoading } = useTopShows(userId);
  const { data: lists, isLoading: listsLoading } = useMyLists(userId);
  // Drafts are OWN-ONLY — never fetch another user's. is_draft=true is NOT hidden
  // by RLS (see 0007), so passing undefined for other profiles keeps the query
  // disabled there; the Drafts row only renders on your own profile anyway.
  const { data: drafts } = useDraftReviews(isOwn ? userId : undefined);
  const { data: listDrafts } = useDraftLists(isOwn ? userId : undefined);
  // The Drafts row counts BOTH unpublished reviews and unpublished lists.
  const draftCount = (drafts?.length ?? 0) + (listDrafts?.length ?? 0);

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
        {/* flex:1 so the skeleton fills the screen and BottomNav stays pinned to
            the bottom during the load — a bare <ProfileSkeleton/> is short, which
            would let BottomNav float up to the middle for a frame. */}
        <View style={{ flex: 1 }}>
          <ProfileSkeleton />
        </View>
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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: isOwn ? 120 : 32 }}>
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
          <Markdown text={profileData.profile.bio} style={styles.bio} />
        ) : null}

        {/* No count chips on the tab labels — they read as clutter (PIL-5).
            `watchedCount` is still used below for the "Your record" summary. */}
        <ProfileTabs active={tab} onChange={setTab} />

        {tab === 'profile' && (
          <ProfileBody
            watching={watching ?? []}
            topShows={topShows ?? []}
            topLoading={topLoading}
            isOwn={isOwn}
            userId={userId}
            // Owner's friendly name (display_name ?? username), already resolved
            // above — feeds the context-aware "{name}'s record" header.
            ownerName={name}
            draftCount={draftCount}
            watchedCount={watchedCount}
            // "Watched — N shows" summary deep-links here: same Shows tab, filter
            // forced to Watched (no second screen — see TASK 2).
            onOpenWatched={() => { setShowsFilter('watched'); setTab('shows'); }}
          />
        )}
        {tab === 'shows' && (
          <>
            <ShowsFilterChips value={showsFilter} onChange={setShowsFilter} />
            {gridLoading ? (
              <PosterGridSkeleton />
            ) : (
              <PosterGrid items={gridShows ?? []} emptyText={emptyTextFor(showsFilter)} />
            )}
          </>
        )}
        {tab === 'lists' && <ListsBody lists={lists ?? []} isLoading={listsLoading} isOwn={isOwn} />}
        {tab === 'watchlist' && (
          <PosterGrid items={watchlist ?? []} emptyText="Nothing on the watchlist yet." />
        )}
      </ScrollView>


      <AvatarViewer uri={avatarUrl} visible={avatarOpen} onClose={() => setAvatarOpen(false)} />
    </SafeAreaView>
  );
}

// Header quick-flip between light/dark. Shows the OPPOSITE mode's icon (a moon in
// light → "go dark", a sun in dark → "go light"). Tapping sets an EXPLICIT manual
// preference; Settings › Appearance is the matching Light/Dark control (the
// 'System' option was removed — PIL-13). Outline icon tinted `ink` (textPrimary)
// to match the share/gear icons it sits beside.
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
  userId,
  ownerName,
  draftCount,
  watchedCount,
  onOpenWatched,
}: {
  watching: CurrentlyWatchingCard[];
  topShows: ShowCard[];
  topLoading: boolean;
  isOwn: boolean;
  userId: string;
  ownerName: string;
  draftCount: number;
  watchedCount: number;
  onOpenWatched: () => void;
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

      {/* "{name}'s record" — the expressive / archive surfaces grouped under one
          borderless headed section, beneath the showcase blocks above. Header is
          context-aware: "My record" on your own profile, "{name}'s record" on
          someone else's (name = display_name ?? username).

          Row scope differs by whose profile this is:
           - Watched (BOTH): a SUMMARY + shortcut — it doesn't open a second
             screen, it jumps to the Shows tab pre-filtered to Watched. On another
             user it lands on THEIR watched grid, so the row works for everyone.
           - Reviews (BOTH): published reviews are public. Own → /profile/reviews
             (with edit/delete); another user → /user/[id]/reviews (read-only).
             Both screens share useMyReviews, which filters drafts.
           - Diary / Drafts (OWN-ONLY): Diary's route reads the signed-in viewer
             (no user-scoped version yet); Drafts are unfinished + own-only. Gate
             both to `isOwn`. Rows are interleaved (not lumped in one block) so the
             own-profile order stays Watched · Diary · Reviews · Drafts.
          `as any`: typed-route union regenerates only when Metro runs. */}
      <SectionHeader title={isOwn ? 'My record' : `${ownerName}'s record`} />
      <View style={styles.record}>
        <RecordRow
          icon={<CheckIcon color={colors.ink} size={20} />}
          label="Watched"
          count={watchedCount}
          onPress={onOpenWatched}
        />
        {isOwn && (
          <RecordRow
            icon={<CalendarIcon color={colors.ink} size={22} />}
            label="Diary"
            onPress={() => router.push('/profile/diary' as any)}
          />
        )}
        <RecordRow
          icon={<ReviewBadgeIcon color={colors.ink} size={20} />}
          label="Reviews"
          onPress={() =>
            router.push((isOwn ? '/profile/reviews' : `/user/${userId}/reviews`) as any)
          }
        />
        {isOwn && (
          <RecordRow
            icon={<DraftIcon color={colors.ink} size={22} />}
            label="Drafts"
            count={draftCount}
            onPress={() => router.push('/profile/drafts' as any)}
          />
        )}
        {/* OWN-ONLY: a private record of reviews/lists you've liked (like Drafts,
            never shown on another user's profile). */}
        {isOwn && (
          <RecordRow
            icon={<HeartIcon color={colors.ink} size={20} />}
            label="Likes"
            onPress={() => router.push('/profile/likes' as any)}
          />
        )}
      </View>
    </View>
  );
}

function WatchingCard({ card }: { card: CurrentlyWatchingCard }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 112 }}>
      {/* No watched-check overlay — these are in-progress, not watched. */}
      {/* transitionMs=0: snap in (no fade) so the shelf matches the instant Top-4 row.
          Its w342 posters aren't memory-warm like the w185 used elsewhere, so the
          200ms crossfade was visible here; with the prefetcher warming them on disk,
          snapping in reads as instant. */}
      <Poster tmdbShowId={card.tmdb_show_id} posterPath={card.poster_path} name={card.name} width={112} transitionMs={0} />
      <Text style={[type.reviewUser, { color: colors.ink, marginTop: 6 }]} numberOfLines={1}>
        {card.name}
      </Text>
      {card.episodeLine && (
        <Text style={[type.epRuntime, { color: colors.muted, marginTop: 1 }]}>{card.episodeLine}</Text>
      )}
    </View>
  );
}

// Shows-tab segment chips (Option A): Watched / Watching, at most one active.
// Tapping the ACTIVE chip clears it → null → the loose "everything" pile. There
// is no dedicated "All" chip — the everything-view is the deselected state.
function ShowsFilterChips({
  value,
  onChange,
}: {
  value: WatchedFilter;
  onChange: (f: WatchedFilter) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const chips: { key: 'watched' | 'watching'; label: string }[] = [
    { key: 'watched', label: 'Watched' },
    { key: 'watching', label: 'Watching' },
  ];
  return (
    <View style={styles.chipRow}>
      {chips.map((c) => {
        const active = value === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(active ? null : c.key)} // tap active → clear → all
            style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
          >
            <Text
              style={[
                active ? type.pillActive : type.pillInactive,
                // Active chip is ink-filled (inverts to light in dark), so its
                // label tracks `background` to stay contrasting in both modes.
                { color: active ? colors.background : colors.ink },
              ]}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Empty-state copy per Shows-tab segment.
function emptyTextFor(filter: WatchedFilter): string {
  if (filter === 'watched') return 'No watched shows yet.';
  if (filter === 'watching') return 'Nothing in progress right now.';
  return 'No shows yet.';
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
        <ListCardsSkeleton />
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

  // Shows-tab segment chips (mirror SeasonPills: ink-filled active, outlined idle).
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: pad, paddingTop: 12, paddingBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  chipActive: { backgroundColor: colors.ink },
  chipInactive: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  shelf: { gap: 12, paddingHorizontal: pad, paddingTop: 12 },

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
