import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius, space } from '@/theme';
import { tmdbImage } from '@/types';

type Props = {
  tmdbShowId: number;
  posterPath?: string | null;
  name: string;
  width?: number;
};

// 2:3 is the canonical poster ratio. We use expo-image (not RN's Image) for
// faster decoding, automatic caching, and built-in placeholders.
// router.push is Expo Router's imperative navigation — the declarative
// equivalent would be wrapping this in <Link href={...}>.
export function Poster({ tmdbShowId, posterPath, name, width = 120 }: Props) {
  const height = width * 1.5;
  const uri = tmdbImage(posterPath, 'w342');

  return (
    <Pressable onPress={() => router.push(`/show/${tmdbShowId}`)} style={{ width }}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width, height }]} contentFit="cover" />
      ) : (
        <View style={[styles.placeholder, { width, height }]}>
          <Text style={styles.placeholderText} numberOfLines={3}>{name}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { borderRadius: radius.md, backgroundColor: colors.hairline },
  placeholder: {
    borderRadius: radius.md,
    backgroundColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
  },
  placeholderText: {
    fontFamily: fonts.bodyMedium,
    color: colors.ink,
    textAlign: 'center',
    fontSize: 12,
  },
});
