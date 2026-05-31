// ListBanner — list-detail header banner: blurred composite of the list's posters + a dark scrim, with the custom-banner render seam.
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme';
import { tmdbImage } from '@/types';

const HEIGHT = 132; // visible banner height per the mock (the screen adds the status-bar inset on top)

type Props = {
  posters: (string | null)[]; // the list's show poster paths, in order
  bannerUrl?: string | null;  // future pick-your-own banner — null today (the seam)
  height?: number;            // total height incl. status-bar inset (set by the screen)
  children?: React.ReactNode; // controls (back / ⋯) overlaid on the scrim
};

export function ListBanner({ posters, bannerUrl, height = HEIGHT, children }: Props) {
  return (
    <View style={[styles.banner, { height }]}>
      {/* Default-with-override: a custom banner wins when it exists; until then we
          auto-composite. Adding pick-your-own later = just populating bannerUrl. */}
      {bannerUrl ? (
        <Image source={{ uri: bannerUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <AutoComposite posters={posters} />
      )}
      {/* Dark scrim so the white back-chevron / ⋯ stay legible over any poster. */}
      <View style={styles.scrim} />
      {children}
    </View>
  );
}

// Tile up to 4 of the list's posters edge-to-edge, blurred. 0 posters → the solid
// banner colour shows through (e.g. an empty list); 1–2 → composite what's there.
function AutoComposite({ posters }: { posters: (string | null)[] }) {
  const uris = posters
    .map((p) => tmdbImage(p, 'w342'))
    .filter((u): u is string => !!u)
    .slice(0, 4);

  if (uris.length === 0) return null; // styles.banner's backgroundColor is the fallback

  return (
    <View style={styles.composite}>
      {uris.map((uri, i) => (
        <Image key={i} source={{ uri }} style={styles.cell} contentFit="cover" blurRadius={18} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { width: '100%', backgroundColor: colors.ink, overflow: 'hidden' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  composite: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  cell: { flex: 1, height: '100%' }, // each poster takes an equal slice of the width
});
