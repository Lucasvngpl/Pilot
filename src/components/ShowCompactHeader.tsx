// ShowCompactHeader — the small header shared by the secondary Show Detail tab
// routes (Seasons / Reviews / Lists): poster + title + a one-line catalog stat.
// The Overview tab (index) uses the full hero instead.
import { View, Text, StyleSheet } from 'react-native';
import { Poster } from '@/components/Poster';
import { type, pad } from '@/theme';
import { useTheme } from '@/lib/theme';

type Props = {
  name: string;
  seasonsCount: number;
  episodesCount: number;
  posterPath?: string | null;
  tmdbShowId: number;
};

export function ShowCompactHeader({
  name, seasonsCount, episodesCount, posterPath, tmdbShowId,
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
        {/* Catalog facts only — NO rating here. The show's rating is Pilot's own
            community average, shown by the Overview hero's StatRow; TMDb's
            vote_average must never surface in the UI (it's catalog reference). */}
        <Text style={[type.epRuntime, { color: colors.muted, marginTop: 4 }]}>
          {seasonsCount} seasons · {episodesCount} episodes
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: { flexDirection: 'row', paddingHorizontal: pad, paddingBottom: 12 },
});
