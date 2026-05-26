import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useShow } from '@/api/useShow';
import { tmdbImage } from '@/types';
import { colors, fonts, space } from '@/theme';

// Dynamic route — the [id] in the filename becomes a URL param.
// useLocalSearchParams = "give me the params for THIS screen". Strings only,
// so we coerce to number before passing to useShow.
export default function ShowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tmdbShowId = Number(id);
  const { data, isLoading, error } = useShow(tmdbShowId);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← back</Text>
        </Pressable>

        {isLoading && <ActivityIndicator style={styles.center} color={colors.ink} />}
        {error && <Text style={[styles.muted, styles.center]}>Couldn&apos;t load show.</Text>}

        {data && (
          <View>
            {data.catalog.poster_path && (
              <Image
                source={{ uri: tmdbImage(data.catalog.poster_path, 'w780') ?? '' }}
                style={styles.poster}
                contentFit="cover"
              />
            )}
            <View style={styles.body}>
              <Text style={styles.title}>{data.catalog.name}</Text>
              {data.catalog.first_air_date && (
                <Text style={styles.year}>{data.catalog.first_air_date.slice(0, 4)}</Text>
              )}
              {data.catalog.overview && (
                <Text style={styles.overview}>{data.catalog.overview}</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  back: { paddingHorizontal: space.base, paddingVertical: space.md },
  backText: { fontFamily: fonts.bodyMedium, color: colors.ink, fontSize: 14 },
  poster: { width: '100%', aspectRatio: 2 / 3 },
  body: { padding: space.base },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  year: {
    fontFamily: fonts.bodyMedium,
    color: colors.mute,
    marginTop: space.xs,
    marginBottom: space.md,
  },
  overview: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, lineHeight: 22 },
  muted: { fontFamily: fonts.body, color: colors.mute, padding: space.base },
  center: { padding: space.xl, textAlign: 'center' },
});
