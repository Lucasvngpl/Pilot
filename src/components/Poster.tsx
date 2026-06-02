// Poster — tappable TMDb show poster that routes to /show/[id]; auto-picks image size from render width; titled placeholder when no image.
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { useScopeSheet } from '@/lib/scopeSheet';
import { Skeleton } from '@/components/Skeleton';
import { fonts, radius, type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';
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
  const styles = useThemedStyles(makeStyles);
  const openSheet = useScopeSheet(); // long-press → quick actions, no navigation
  const height = width * 1.5;
  const uri = tmdbImage(posterPath, sizeFor(width));

  const inner = uri ? (
    <PosterImage uri={uri} width={width} height={height} />
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
    <Pressable
      onPress={() => router.push(`/show/${tmdbShowId}`)}
      // Long-press = quick actions for this show WITHOUT leaving the page. When
      // onLongPress fires, RN suppresses onPress, so the hold doesn't also navigate.
      onLongPress={() => openSheet({ tmdb_show_id: tmdbShowId, season_number: null, episode_number: null })}
      delayLongPress={280}
    >
      {inner}
    </Pressable>
  );
}

// Shows a pulsing skeleton in the poster's place until the image loads, then the
// image cross-fades in. The wrapper keeps a static light fill behind it so the
// fade lands on grey, not a white flash. `onError` also clears the skeleton so a
// failed image doesn't pulse forever.
function PosterImage({ uri, width, height }: { uri: string; width: number; height: number }) {
  const styles = useThemedStyles(makeStyles);
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[styles.imageWrap, { width, height }]}>
      {!loaded && <Skeleton radius={radius.md} style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri }}
        style={{ width, height, borderRadius: radius.md }}
        contentFit="cover"
        transition={200}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  imageWrap: { borderRadius: radius.md, backgroundColor: colors.field, overflow: 'hidden' },
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
