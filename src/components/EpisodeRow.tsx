// EpisodeRow — rich episode list item for the Seasons/browse surface: lazy still
// thumbnail, shared scope label + title + air date, the USER'S OWN rating (if any),
// and stacked inline actions (eye = watched toggle, pencil = review/log).
//
// Row identity (still + label + title) is reusable across surfaces; the trailing
// eye+pencil are SPECIFIC to this browse surface — other surfaces (add-to-list,
// list-detail) swap the trailing actions. Tap = Episode Detail, long-press = the
// full ScopeActions menu; the inline buttons claim their own touches so a button
// tap never also triggers the row's navigation.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { EyeIcon, PencilSquareIcon, StarIcon } from '@/components/icons';
import { tmdbImage, formatScopeShort, formatAirDate } from '@/types';
import { type, pad, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  airDate?: string | null;
  stillPath?: string | null;
  // Shown in the still slot when the episode has no still — season or show art.
  fallbackPosterPath?: string | null;
  watched: boolean;
  rating?: number | null; // the user's OWN episode-scope rating; hidden when null
  onToggleWatched: () => void;
  onReview: () => void;
  onOpenDetail: () => void;
  onLongPress: () => void;
};

export function EpisodeRow({
  seasonNumber, episodeNumber, title, airDate, stillPath, fallbackPosterPath,
  watched, rating, onToggleWatched, onReview, onOpenDetail, onLongPress,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  const stillUri = tmdbImage(stillPath, 'w342') ?? tmdbImage(fallbackPosterPath, 'w185');
  const date = formatAirDate(airDate);
  const ratingText = rating != null ? (rating % 1 === 0 ? String(rating) : rating.toFixed(1)) : null;

  return (
    <Pressable style={styles.row} onPress={onOpenDetail} onLongPress={onLongPress} delayLongPress={280}>
      {/* Lazy still — expo-image fetches async + caches, so it never blocks scroll. */}
      <View style={styles.still}>
        {stillUri ? (
          <Image source={{ uri: stillUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.field }]} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={[type.epRating, { color: colors.muted }]}>{formatScopeShort(seasonNumber, episodeNumber)}</Text>
        <Text style={[type.reviewTitle, { color: colors.ink, marginTop: 1 }]} numberOfLines={1}>{title}</Text>
        <View style={styles.meta}>
          {date && <Text style={[type.epRuntime, { color: colors.muted }]}>{date}</Text>}
          {ratingText && (
            <>
              {date && <Text style={[type.epRuntime, { color: colors.muted }]}>{'  ·  '}</Text>}
              <StarIcon color={colors.gold} size={11} />
              <Text style={[type.epRating, { color: colors.muted, marginLeft: 3 }]}>{ratingText}</Text>
            </>
          )}
        </View>
      </View>

      {/* Stacked inline actions. Nested Pressables claim their own touches, so a
          tap here does its action only — never the row's onOpenDetail. */}
      <View style={styles.actions}>
        <Pressable onPress={onToggleWatched} hitSlop={8} style={styles.actionBtn}>
          {/* Distinct ON/OFF: filled purple (the app's watched accent) vs grey outline. */}
          <EyeIcon color={watched ? colors.purple : colors.faint} size={22} filled={watched} />
        </Pressable>
        <Pressable onPress={onReview} hitSlop={8} style={styles.actionBtn}>
          <PencilSquareIcon color={colors.muted} size={20} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: pad,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    gap: 12,
  },
  // 16:9 landscape still.
  still: { width: 104, height: 58, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.field },
  body: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  actions: { alignItems: 'center', gap: 14 },
  actionBtn: { padding: 2 },
});
