import { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';
import { Image } from 'expo-image';
import { colors, type, pad, radius } from '@/theme';
import { DotsIcon, HeartIcon } from '@/components/icons';
import { Stars } from '@/components/Stars';
import { Poster } from '@/components/Poster';

// How many lines of a review body show before we offer "Read more".
const COLLAPSED_LINES = 4;

type Props = {
  username: string;
  avatarUri?: string;
  showTitle: string;
  seasonLine?: string;
  rating: number; // 0..5, half-step — rendered by <Stars>, which clips half fills
  body: string;
  containsSpoilers: boolean;
  likes: number;
  tmdbShowId: number;
  posterPath?: string | null;
};

export function ReviewRow(p: Props) {
  const [expanded, setExpanded] = useState(false);
  const [truncatable, setTruncatable] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // onTextLayout hands us the text's full line breakdown. If it would wrap past
  // COLLAPSED_LINES, we reveal the "Read more" toggle. We latch it true once and
  // never flip back — a body that's long stays long.
  const onTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      if (!truncatable && e.nativeEvent.lines.length > COLLAPSED_LINES) {
        setTruncatable(true);
      }
    },
    [truncatable],
  );

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        {p.avatarUri ? (
          <Image source={{ uri: p.avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
        )}
        <Text style={[type.reviewUser, { color: colors.ink, flex: 1, marginLeft: 8 }]}>
          {p.username}
        </Text>
        <DotsIcon color={colors.faint} size={16} />
      </View>

      <View style={styles.body}>
        <View style={styles.text}>
          <Text style={[type.reviewTitle, { color: colors.ink }]}>{p.showTitle}</Text>
          {p.seasonLine && (
            <Text style={[type.reviewSeason, { color: colors.muted, marginTop: 2 }]}>
              {p.seasonLine}
            </Text>
          )}
          <View style={styles.stars}>
            {/* Shared half-star renderer (same one UserRatingCard uses). The old
                hand-rolled loop did `s <= Math.round(rating)`, so 4.5 rounded up
                to 5 full stars. <Stars> clips a half-width fill instead. */}
            <Stars value={p.rating} size={12} color={colors.gold} />
          </View>

          {p.containsSpoilers && !revealed ? (
            // The spoiler flag is set at compose time; honor it by hiding the
            // body behind a tap rather than rendering it. (It was being ignored
            // — a spoiler-tagged review spoiled you anyway, the whole point of
            // the flag unmet.) No blur dependency: we simply don't mount the
            // text until the reader opts in.
            <Pressable style={styles.spoiler} onPress={() => setRevealed(true)}>
              <Text style={[type.reviewBody, styles.spoilerText]}>
                This review may contain spoilers. Tap to reveal.
              </Text>
            </Pressable>
          ) : (
            // Tap to expand a long review in place. No review-detail screen
            // exists yet (comments aren't built), so inline expand/collapse is
            // the smallest thing that lets you read the whole body. `disabled`
            // keeps short reviews from being a dead tap target.
            <Pressable onPress={() => setExpanded((v) => !v)} disabled={!truncatable}>
              <Text
                style={[type.reviewBody, { color: colors.ink, marginTop: 8 }]}
                numberOfLines={expanded ? undefined : COLLAPSED_LINES}
                onTextLayout={onTextLayout}
              >
                {p.body}
              </Text>
              {truncatable && (
                <Text style={[type.reviewMeta, { color: colors.purple, marginTop: 4 }]}>
                  {expanded ? 'Show less' : 'Read more'}
                </Text>
              )}
            </Pressable>
          )}
        </View>
        <Poster
          tmdbShowId={p.tmdbShowId}
          posterPath={p.posterPath}
          name={p.showTitle}
          width={46}
          pressable={false}
        />
      </View>

      {/* Read-only metadata — no like or comment action exists yet, so we show
          the count passively instead of faking tappable buttons. */}
      <View style={styles.meta}>
        <HeartIcon color={colors.muted} size={14} />
        <Text style={[type.reviewMeta, { color: colors.muted, marginLeft: 5 }]}>
          {p.likes} {p.likes === 1 ? 'like' : 'likes'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 16,
    paddingHorizontal: pad,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  body: { flexDirection: 'row', gap: 12 },
  text: { flex: 1 },
  stars: { flexDirection: 'row', gap: 1, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  spoiler: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.field,
  },
  spoilerText: { color: colors.muted, fontStyle: 'italic' },
});
