import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePopular } from '@/api/usePopular';
import { Poster } from '@/components/Poster';
import { BottomNav } from '@/components/BottomNav';
import { FAB } from '@/components/FAB';
import { HamburgerIcon, StarIcon } from '@/components/icons';
import { colors, type, pad, fonts } from '@/theme';
import type { TmdbPayload } from '@/types';

// TODO(phase-future): real feed of friend activity. Mocked so the layout
// reads correctly while we ship the catalog flow.
const MOCK_FRIENDS = [
  { username: 'connor4usa', rating: 4.5 },
  { username: 'shivwam',    rating: 4.0 },
  { username: 'kendallg',   rating: 4.5 },
];

export default function Home() {
  const { data, isLoading, error } = usePopular(20);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable hitSlop={8}><HamburgerIcon color={colors.ink} size={22} /></Pressable>
        <Text style={[type.wordmark, { color: colors.ink, marginLeft: 12 }]}>
          Popular in Community
        </Text>
      </View>

      {isLoading && <ActivityIndicator style={styles.center} color={colors.ink} />}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load shows.</Text>}

      {data && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
          <Section title="Popular Shows This Week">
            <PosterRow shows={data.shows.slice(0, 5)} />
          </Section>

          <Section title="New From Friends">
            <PosterRow
              shows={data.shows.slice(5, 8)}
              renderBelow={(_, i) => (
                <FriendInfo
                  username={MOCK_FRIENDS[i]?.username ?? '—'}
                  rating={MOCK_FRIENDS[i]?.rating ?? 0}
                />
              )}
            />
          </Section>
        </ScrollView>
      )}

      <FAB />
      <BottomNav active="home" />
    </SafeAreaView>
  );
}

// Section header MUST hug content height — fixed height causes Archivo Black
// to overflow into the row above (spec gotcha).
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={[type.sectionH, { color: colors.ink, paddingHorizontal: pad }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function PosterRow({
  shows, renderBelow,
}: {
  shows: Array<{ tmdb_show_id: number; payload: TmdbPayload }>;
  renderBelow?: (show: { tmdb_show_id: number; payload: TmdbPayload }, i: number) => React.ReactNode;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelf}>
      {shows.map((s, i) => (
        <View key={s.tmdb_show_id} style={{ width: 118 }}>
          <Poster
            tmdbShowId={s.tmdb_show_id}
            posterPath={s.payload.poster_path}
            name={s.payload.name}
            width={118}
          />
          {renderBelow?.(s, i)}
        </View>
      ))}
    </ScrollView>
  );
}

function FriendInfo({ username, rating }: { username: string; rating: number }) {
  return (
    <View style={styles.friend}>
      <View style={styles.friendAvatar} />
      <View style={{ marginLeft: 8 }}>
        <Text style={[type.friendName, { color: colors.ink }]}>{username}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <StarIcon
              key={s}
              color={s <= Math.round(rating) ? colors.gold : colors.hairline}
              size={9}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: pad,
    paddingTop: 8,
    paddingBottom: 12,
  },
  section: { marginTop: 8, marginBottom: 16 },
  shelf: { gap: 12, paddingHorizontal: pad, paddingTop: 12 },
  friend: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  friendAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.hairline },
  stars: { flexDirection: 'row', gap: 1, marginTop: 2 },
  muted: { fontFamily: fonts.regular, color: colors.muted },
  center: { padding: pad, textAlign: 'center' },
});
