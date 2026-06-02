// ShowCompactHeader — the small header shared by the Show Detail tab routes
// (Overview / Seasons / Lists): poster + title + a one-line stat row. The index
// (Reviews) tab uses the full hero; these secondary tabs use this compact form.
import { View, Text, StyleSheet } from 'react-native';
import { Poster } from '@/components/Poster';
import { StarIcon } from '@/components/icons';
import { type, pad } from '@/theme';
import { useTheme } from '@/lib/theme';

type Props = {
  name: string;
  rating?: number;        // TMDb vote_average (0–10), shown to one decimal
  seasonsCount: number;
  episodesCount: number;
  posterPath?: string | null;
  tmdbShowId: number;
};

export function ShowCompactHeader({
  name, rating, seasonsCount, episodesCount, posterPath, tmdbShowId,
}: Props) {
  // Only inline colors here — the layout styles below carry no color, so they
  // stay a plain (non-themed) StyleSheet.
  const { colors } = useTheme();
  return (
    <View style={styles.compact}>
      <Poster
        tmdbShowId={tmdbShowId}
        posterPath={posterPath}
        name={name}
        width={58}
        pressable={false}
      />
      <View style={{ flex: 1, marginLeft: 12, justifyContent: 'center' }}>
        <Text style={[type.compactH, { color: colors.ink }]} numberOfLines={1}>
          {name.toUpperCase()}
        </Text>
        <View style={styles.compactSub}>
          <StarIcon color={colors.gold} size={12} />
          <Text style={[type.epRuntime, { color: colors.muted, marginLeft: 4 }]}>
            {rating?.toFixed(1) ?? '—'} · {seasonsCount} seasons · {episodesCount} episodes
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', paddingHorizontal: pad, paddingBottom: 12 },
  compactSub: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
});
