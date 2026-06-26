import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useActivityFeed, type ActivityMode } from '@/api/useActivityFeed';
import { Poster } from '@/components/Poster';
import { Stars } from '@/components/Stars';
import { Markdown } from '@/components/Markdown';
import { ActivityRowsSkeleton } from '@/components/Skeletons';
import { tmdbImage } from '@/types';
import { timeAgo } from '@/lib/timeAgo';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { ActivityActor, ActivityItem } from '@/types';

// Activity → two tabs: Friends (what the people you follow did) and You (your own
// activity). Each is the same time-ordered stream — watched / watchlist / review /
// list / like / follow — for a different actor set.
export default function Activity() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();
  const [tab, setTab] = useState<ActivityMode>('friends');
  const { data: items, isLoading } = useActivityFeed(tab);

  const empty =
    tab === 'friends'
      ? 'Follow people to see their activity here.'
      : 'Your activity will show up here.';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Text style={[type.subhead, { color: colors.ink }]}>Activity</Text>
      </View>

      {/* Friends / You tab bar (underline, like the profile tabs). */}
      <View style={styles.tabs}>
        {(['friends', 'you'] as const).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={styles.tab} hitSlop={6}>
              <Text style={[styles.tabLabel, { color: active ? colors.ink : colors.muted }]}>
                {t === 'friends' ? 'Friends' : 'You'}
              </Text>
              <View style={[styles.tabUnderline, { backgroundColor: active ? colors.ink : 'transparent' }]} />
            </Pressable>
          );
        })}
      </View>

      {/* flex:1 so the content region fills the screen and BottomNav stays pinned. */}
      <View style={{ flex: 1 }}>
        {!user ? (
          <Text style={styles.empty}>Log in to see activity.</Text>
        ) : isLoading ? (
          <ActivityRowsSkeleton />
        ) : !items || items.length === 0 ? (
          <Text style={styles.empty}>{empty}</Text>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
            {items.map((item) => (
              <ActivityRow key={item.key} item={item} viewerId={user.id} />
            ))}
          </ScrollView>
        )}
      </View>

    </SafeAreaView>
  );
}

// ----- Rows -----------------------------------------------------------------

function Avatar({ actor }: { actor: ActivityActor }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => router.push(`/user/${actor.id}` as any)} hitSlop={6}>
      {actor.avatar_url ? (
        <Image source={{ uri: actor.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
      )}
    </Pressable>
  );
}

function ActivityRow({ item, viewerId }: { item: ActivityItem; viewerId: string }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // On the "You" tab (and any self-authored row) the actor IS the viewer → "You".
  const isYou = item.actor.id === viewerId;

  switch (item.type) {
    case 'watched':
      return (
        <FeedRow onPress={() => router.push(`/show/${item.show.tmdb_show_id}`)}>
          <Avatar actor={item.actor} />
          <View style={styles.body}>
            <HeaderLine isYou={isYou} actor={item.actor} verb="watched" object={item.show.name} at={item.at} />
            <View style={styles.posterRow}>
              <Poster tmdbShowId={item.show.tmdb_show_id} posterPath={item.show.poster_path} name={item.show.name} width={48} pressable={false} />
              {item.rating != null && (
                <View style={styles.posterMeta}>
                  <Stars value={item.rating} size={12} color={colors.gold} />
                </View>
              )}
            </View>
          </View>
        </FeedRow>
      );

    case 'reviewed':
      return (
        <FeedRow onPress={() => router.push(`/show/${item.show.tmdb_show_id}`)}>
          <Avatar actor={item.actor} />
          <View style={styles.body}>
            <HeaderLine
              isYou={isYou} actor={item.actor} verb="reviewed"
              object={item.show.name + (item.scopeLabel ? ` · ${item.scopeLabel}` : '')}
              at={item.at}
            />
            <View style={styles.posterRow}>
              <Poster tmdbShowId={item.show.tmdb_show_id} posterPath={item.show.poster_path} name={item.show.name} width={48} pressable={false} />
              <View style={styles.posterMeta}>
                {item.rating != null && <Stars value={item.rating} size={12} color={colors.gold} />}
                {item.containsSpoilers ? (
                  <Text style={styles.reviewBody} numberOfLines={2}>Contains spoilers</Text>
                ) : (
                  // Clamped markdown so feed snippets don't show raw ** / [..](..).
                  <Markdown text={item.body} style={styles.reviewBody} numberOfLines={2} />
                )}
              </View>
            </View>
          </View>
        </FeedRow>
      );

    case 'watchlist':
      return (
        <FeedRow onPress={() => router.push(`/show/${item.show.tmdb_show_id}`)}>
          <Avatar actor={item.actor} />
          <View style={styles.body}>
            <HeaderLine isYou={isYou} actor={item.actor} verb="added" object={item.show.name} suffix=" to their watchlist" at={item.at} />
          </View>
        </FeedRow>
      );

    case 'listed':
      return (
        <FeedRow onPress={() => router.push(`/list/${item.listId}` as any)}>
          <Avatar actor={item.actor} />
          <View style={styles.body}>
            <HeaderLine
              isYou={isYou} actor={item.actor} verb="listed" object={item.title}
              suffix={`  (${item.count} ${item.count === 1 ? 'show' : 'shows'})`}
              at={item.at}
            />
            {item.posters.length > 0 && (
              <View style={styles.listStrip}>
                {item.posters.map((p, i) => {
                  const uri = p ? tmdbImage(p, 'w185') : null;
                  return <Image key={i} source={uri ? { uri } : undefined} style={styles.listPoster} />;
                })}
              </View>
            )}
          </View>
        </FeedRow>
      );

    case 'liked':
      // "liked {owner}'s review of {Show}" / "liked {owner}'s list {Title}".
      // Title/show bold (the object); the rest muted (the verb phrase).
      if (item.target === 'review') {
        return (
          <FeedRow onPress={() => router.push(`/review/${item.reviewId}` as any)}>
            <Avatar actor={item.actor} />
            <View style={styles.body}>
              <HeaderLine
                isYou={isYou} actor={item.actor}
                verb={`liked ${item.ownerName}'s review of`}
                object={item.show.name}
                suffix={item.scopeLabel ? ` · ${item.scopeLabel}` : undefined}
                at={item.at}
              />
              <View style={styles.posterRow}>
                <Poster tmdbShowId={item.show.tmdb_show_id} posterPath={item.show.poster_path} name={item.show.name} width={48} pressable={false} />
              </View>
            </View>
          </FeedRow>
        );
      }
      return (
        <FeedRow onPress={() => router.push(`/list/${item.listId}` as any)}>
          <Avatar actor={item.actor} />
          <View style={styles.body}>
            <HeaderLine
              isYou={isYou} actor={item.actor}
              verb={`liked ${item.ownerName}'s list`}
              object={item.title}
              at={item.at}
            />
          </View>
        </FeedRow>
      );

    case 'followed':
      return (
        <FeedRow onPress={() => router.push(`/user/${item.target.id}` as any)}>
          <Avatar actor={item.actor} />
          <View style={styles.body}>
            <HeaderLine
              isYou={isYou} actor={item.actor} verb="followed"
              object={item.target.display_name ?? item.target.username}
              at={item.at}
            />
          </View>
        </FeedRow>
      );
  }
}

function FeedRow({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {children}
    </Pressable>
  );
}

// "{name} verb **object** suffix" on the left, relative time on the right. `isYou`
// renders the actor as "You" (the You tab + any self-authored row).
function HeaderLine({
  isYou, actor, verb, object, suffix, at,
}: {
  isYou: boolean; actor: ActivityActor; verb: string; object: string; suffix?: string; at: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.headerLine}>
      <Text style={styles.headerText} numberOfLines={2}>
        <Text style={styles.user}>{isYou ? 'You' : (actor.display_name ?? actor.username)}</Text>
        <Text style={styles.connective}> {verb} </Text>
        <Text style={styles.object}>{object}</Text>
        {suffix ? <Text style={styles.connective}>{suffix}</Text> : null}
      </Text>
      <Text style={styles.time}>{timeAgo(at)}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: pad },

  tabs: { flexDirection: 'row', gap: 24, paddingHorizontal: pad, borderBottomWidth: 1, borderBottomColor: colors.hairline },
  tab: { paddingTop: 4, alignItems: 'center' },
  tabLabel: { fontFamily: fonts.semibold, fontSize: 15, paddingBottom: 8 },
  tabUnderline: { height: 2, alignSelf: 'stretch', borderRadius: 1 },

  empty: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 40,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: pad,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  body: { flex: 1 },

  headerLine: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, fontSize: 14, lineHeight: 19 },
  user: { fontFamily: fonts.medium, color: colors.ink },
  connective: { fontFamily: fonts.regular, color: colors.muted },
  object: { fontFamily: fonts.semibold, color: colors.ink },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginLeft: 8 },

  posterRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  posterMeta: { flex: 1, gap: 6, paddingTop: 2 },
  reviewBody: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },

  listStrip: { flexDirection: 'row', gap: 6, marginTop: 8 },
  listPoster: { width: 44, height: 66, borderRadius: 4, backgroundColor: colors.hairline },
});
