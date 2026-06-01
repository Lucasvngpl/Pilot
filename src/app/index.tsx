// / — Home feed: "Popular on TV" shelf (TMDb trending) + "New From Friends" shelf (followee activity), with a purple FAB for logging.
import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTrendingShows } from '@/api/useTrendingShows';
import { useActivityFeed } from '@/api/useActivityFeed';
import { Poster } from '@/components/Poster';
import { BottomNav } from '@/components/BottomNav';
import { ActionMenuSheet } from '@/components/ActionMenuSheet';
import { FAB } from '@/components/FAB';
import { HomeSkeleton } from '@/components/Skeletons';
import { StarIcon, ChevronRightIcon } from '@/components/icons';
import { type, pad, fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { SearchShowResult, ActivityActor, ActivityItem } from '@/types';

// "New From Friends" = shows a followee recently watched or reviewed. Derived
// from the same activity feed (no fabricated friends — real-and-empty beats
// fake-and-full, per the viewer-cluster / activity-feed principle).
type FeedShowItem = Extract<ActivityItem, { type: 'watched' | 'reviewed' }>;

export default function Home() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Slim trending (name + poster only) — NOT get-popular, which ships the full
  // ~16MB payload blob per shelf load. Shared with Search's trending state.
  const { data, isLoading, error } = useTrendingShows(20);
  const { data: activity } = useActivityFeed();
  const [logMenuOpen, setLogMenuOpen] = useState(false); // purple FAB → same log/list menu

  // Watched/reviewed events from people you follow, deduped to one tile per show.
  const seen = new Set<number>();
  const friendShows = (activity ?? [])
    .filter((i): i is FeedShowItem => i.type === 'watched' || i.type === 'reviewed')
    .filter((i) => {
      if (seen.has(i.show.tmdb_show_id)) return false;
      seen.add(i.show.tmdb_show_id);
      return true;
    })
    .slice(0, 12);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Centered brand wordmark — matches the auth screen's PILOT treatment
          (ArchivoBlack 20, letterSpacing 3). Replaces the old hamburger + "Discover". */}
      <View style={styles.topBar}>
        <Text style={[type.wordmark, { color: colors.ink, fontSize: 20, letterSpacing: 3 }]}>PILOT</Text>
      </View>

      {isLoading && <HomeSkeleton />}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load shows.</Text>}

      {data && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
          {/* Honest label: this is TMDb world-popularity, not in-app activity. */}
          <Section title="Popular on TV">
            <PosterRow shows={data.slice(0, 8)} />
          </Section>

          <Section title="New From Friends">
            {friendShows.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
                {friendShows.map((item) => (
                  <View key={item.key} style={{ width: 118 }}>
                    <Poster
                      tmdbShowId={item.show.tmdb_show_id}
                      posterPath={item.show.poster_path}
                      name={item.show.name}
                      width={118}
                    />
                    <FriendInfo actor={item.actor} rating={item.rating} />
                  </View>
                ))}
              </ScrollView>
            ) : (
              <FollowPrompt />
            )}
          </Section>
        </ScrollView>
      )}

      <FAB onPress={() => setLogMenuOpen(true)} />
      <BottomNav active="home" />

      {/* Same log/list menu as the nav's "Log" tab — the FAB is a second, more
          prominent entry point on Home (kept deliberately, redundant by design). */}
      <ActionMenuSheet
        visible={logMenuOpen}
        onClose={() => setLogMenuOpen(false)}
        actions={[
          { label: 'Review or log', onPress: () => router.push('/search?log=1' as any) },
          { label: 'New list', onPress: () => router.push('/list/new' as any) },
        ]}
      />
    </SafeAreaView>
  );
}

// Section header MUST hug content height — fixed height causes Archivo Black
// to overflow into the row above (spec gotcha).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[type.sectionH, { color: colors.ink, paddingHorizontal: pad }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function PosterRow({ shows }: { shows: SearchShowResult[] }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
      {shows.map((s) => (
        <View key={s.tmdb_show_id} style={{ width: 118 }}>
          <Poster tmdbShowId={s.tmdb_show_id} posterPath={s.poster_path} name={s.name} width={118} />
        </View>
      ))}
    </ScrollView>
  );
}

function FriendInfo({ actor, rating }: { actor: ActivityActor; rating: number | null }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.friend}>
      {actor.avatar_url ? (
        <Image source={{ uri: actor.avatar_url }} style={styles.friendAvatar} />
      ) : (
        <View style={styles.friendAvatar} />
      )}
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={[type.friendName, { color: colors.ink }]} numberOfLines={1}>
          {actor.display_name ?? actor.username}
        </Text>
        {rating != null && (
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <StarIcon key={s} color={s <= Math.round(rating) ? colors.gold : colors.hairline} size={9} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// Empty state — no fabricated friends. Points to where you'd add some.
function FollowPrompt() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.followPrompt} onPress={() => router.push('/search?tab=people' as any)}>
      <Text style={styles.followPromptText}>Follow people to see what they&apos;re watching</Text>
      <ChevronRightIcon color={colors.muted} size={18} />
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    alignItems: 'center', // center the wordmark
    paddingHorizontal: pad,
    paddingTop: 8,
    paddingBottom: 12,
  },
  section: { marginTop: 8, marginBottom: 16 },
  shelf: { gap: 12, paddingHorizontal: pad, paddingTop: 12 },
  friend: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  friendAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.hairline },
  stars: { flexDirection: 'row', gap: 1, marginTop: 2 },
  followPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: pad,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.field,
  },
  followPromptText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },
});
