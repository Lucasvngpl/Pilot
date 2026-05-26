import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePopular } from '@/api/usePopular';
import { Poster } from '@/components/Poster';
import { colors, fonts, space } from '@/theme';
import type { TmdbPayload } from '@/types';

// Home screen — two poster shelves wired to the get-popular Edge Function.
// limit=20 covers ten posters per shelf.
export default function Home() {
  const { data, isLoading, error } = usePopular(20);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.brand}>Pilot</Text>

      {isLoading && <ActivityIndicator style={styles.center} color={colors.ink} />}
      {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load shows.</Text>}

      {data && (
        <ScrollView>
          <Shelf title="Popular this week" shows={data.shows.slice(0, 10)} />
          <Shelf title="Also trending" shows={data.shows.slice(10, 20)} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type ShelfItem = { tmdb_show_id: number; payload: TmdbPayload };

// Horizontal FlatList — virtualized so off-screen posters aren't rendered.
function Shelf({ title, shows }: { title: string; shows: ShelfItem[] }) {
  return (
    <View style={styles.shelf}>
      <Text style={styles.shelfTitle}>{title}</Text>
      <FlatList
        data={shows}
        horizontal
        keyExtractor={(item) => String(item.tmdb_show_id)}
        contentContainerStyle={styles.shelfContent}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <Poster
            tmdbShowId={item.tmdb_show_id}
            posterPath={item.payload.poster_path}
            name={item.payload.name}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  brand: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    paddingHorizontal: space.base,
    paddingTop: space.base,
    paddingBottom: space.lg,
  },
  shelf: { paddingBottom: space.xl },
  shelfTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: space.base,
    paddingBottom: space.md,
  },
  shelfContent: { paddingHorizontal: space.base, gap: space.md },
  muted: { fontFamily: fonts.body, color: colors.mute },
  center: { padding: space.xl, textAlign: 'center' },
});
