import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, radius } from '@/theme';
import { tmdbImage } from '@/types';

type Props = {
  tmdbShowId: number;
  posterPath?: string | null;
  name: string;
  width: number;       // height auto-derived as width * 1.5 (2:3 ratio)
  pressable?: boolean; // false for the hero / mini header poster
};

// Pick the right TMDb image size based on render width — fetching w500 for a
// 46px thumb wastes bandwidth.
function sizeFor(width: number): 'w185' | 'w342' | 'w500' {
  if (width <= 100) return 'w185';
  if (width <= 200) return 'w342';
  return 'w500';
}

export function Poster({ tmdbShowId, posterPath, name, width, pressable = true }: Props) {
  const height = width * 1.5;
  const uri = tmdbImage(posterPath, sizeFor(width));

  const inner = uri ? (
    <Image
      source={{ uri }}
      style={{ width, height, borderRadius: radius.md }}
      contentFit="cover"
    />
  ) : (
    <View style={[styles.placeholder, { width, height }]}>
      <Text
        style={[styles.placeholderText, { fontSize: Math.max(10, width / 9) }]}
        numberOfLines={2}
      >
        {name.toUpperCase()}
      </Text>
    </View>
  );

  if (!pressable) return inner;
  return (
    <Pressable onPress={() => router.push(`/show/${tmdbShowId}`)}>{inner}</Pressable>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  placeholderText: {
    fontFamily: fonts.display,
    color: colors.red,
    textAlign: 'center',
  },
});
