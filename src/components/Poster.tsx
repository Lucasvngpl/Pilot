// Poster — tappable TMDb show poster that routes to /show/[id]; auto-picks image size from render width; titled placeholder when no image.
import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { router } from 'expo-router';
import { useScopeSheet } from '@/lib/scopeSheet';
import { Skeleton } from '@/components/Skeleton';
import { fonts, radius, type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';
import { tmdbImage, scopeHref } from '@/types';

type Props = {
  tmdbShowId: number;
  posterPath?: string | null;
  name: string;
  width: number;       // height auto-derived as width * 1.5 (2:3 ratio)
  pressable?: boolean; // false for the hero / mini header poster
  // Scope of THIS poster. When set, tapping routes to the season/episode (not just
  // the show) and long-press opens that scope's quick actions (PIL-6). Omitted =
  // whole-show poster, the default everywhere it isn't a season/episode tile.
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  // Crossfade duration (ms) when the image loads in. Default 200. Pass 0 on
  // surfaces where posters should SNAP in instead of fading — e.g. the
  // currently-watching shelf, so it matches the instant feel of the Top-4 row.
  transitionMs?: number;
};

// Pick the right TMDb image size based on render width — fetching w500 for a
// 46px thumb wastes bandwidth.
function sizeFor(width: number): 'w185' | 'w342' | 'w500' {
  if (width <= 100) return 'w185';
  if (width <= 200) return 'w342';
  return 'w500';
}

export function Poster({
  tmdbShowId,
  posterPath,
  name,
  width,
  pressable = true,
  seasonNumber = null,
  episodeNumber = null,
  transitionMs = 200,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const openSheet = useScopeSheet(); // long-press → quick actions, no navigation
  const height = width * 1.5;
  const uri = tmdbImage(posterPath, sizeFor(width));

  const inner = uri ? (
    <PosterImage uri={uri} width={width} height={height} transitionMs={transitionMs} />
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
      // Route to this poster's own scope: season/episode tiles open the season or
      // episode, whole-show tiles open the show (PIL-6).
      onPress={() => router.push(scopeHref(tmdbShowId, seasonNumber, episodeNumber) as any)}
      // Long-press = quick actions for THIS scope WITHOUT leaving the page. When
      // onLongPress fires, RN suppresses onPress, so the hold doesn't also navigate.
      onLongPress={() =>
        openSheet({ tmdb_show_id: tmdbShowId, season_number: seasonNumber, episode_number: episodeNumber })
      }
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
function PosterImage({ uri, width, height, transitionMs }: { uri: string; width: number; height: number; transitionMs: number }) {
  const styles = useThemedStyles(makeStyles);
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={[styles.imageWrap, { width, height }]}>
      {!loaded && <Skeleton radius={radius.md} style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri }}
        style={{ width, height, borderRadius: radius.md }}
        contentFit="cover"
        transition={transitionMs}
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
