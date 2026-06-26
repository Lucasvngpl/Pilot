// ReviewRow — one review card: avatar + show title + star rating + truncated body (tap → full-review page) + spoiler gate + interactive like bar + optional ⋯ menu for own reviews.
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { type, pad, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { DotsIcon } from '@/components/icons';
import { Stars } from '@/components/Stars';
import { Poster } from '@/components/Poster';
import { Markdown } from '@/components/Markdown';
import { ReviewLikeBar } from '@/components/LikeBar';

// Lines of body shown in the row before the trailing "…". The full text lives on
// the review's own page (/review/[id]); tapping the body navigates there.
const BODY_LINES = 4;

type Props = {
  username: string;
  displayName?: string | null; // shown name; falls back to username (the handle)
  avatarUri?: string;
  showTitle: string;
  seasonLine?: string;
  rating: number; // 0..5, half-step — rendered by <Stars>, which clips half fills
  body: string;
  containsSpoilers: boolean;
  likes: number;
  // Published review id → renders the interactive like bar (heart + likers +
  // count) seeded with `likes`. OMITTED for drafts (a draft can't be liked — it's
  // hidden from every public query), which then show no like affordance at all.
  reviewId?: string;
  tmdbShowId: number;
  posterPath?: string | null;
  // Provided ONLY for the current user's own reviews → shows the ⋯ menu. Omitted
  // for everyone else's, so the ⋯ isn't a dead control on reviews you can't act on.
  onMenu?: () => void;
  // On the show screen you're already on that show, so the poster is inert. On
  // the "my reviews" list it's the way into each show → make it tappable there.
  posterPressable?: boolean;
  // Tapping the body opens the full review (/review/[id]) — or, for drafts, the
  // composer. The ⋯ menu, spoiler gate, and poster claim their own taps, so they
  // never trigger this.
  onPress?: () => void;
};

export function ReviewRow(p: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        {p.avatarUri ? (
          <Image source={{ uri: p.avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
        )}
        <Text style={[type.reviewUser, { color: colors.ink, flex: 1, marginLeft: 8 }]}>
          {p.displayName ?? p.username}
        </Text>
        {p.onMenu && (
          <Pressable onPress={p.onMenu} hitSlop={8}>
            <DotsIcon color={colors.faint} size={16} />
          </Pressable>
        )}
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
            // Tap the body to read the review in full on its own page
            // (/review/[id]). The row stays clamped to BODY_LINES — the trailing
            // "…" signals there's more — and the page shows the untruncated text.
            // Drafts route this to the composer instead.
            <Pressable onPress={p.onPress}>
              {/* Clamped markdown preview — bold/italic/links render, "> " markers
                  are dropped (indent isn't meaningful in a 4-line teaser). */}
              <Markdown
                text={p.body}
                style={[type.reviewBody, { color: colors.ink, marginTop: 8 }]}
                numberOfLines={BODY_LINES}
              />
            </Pressable>
          )}
        </View>
        <Poster
          tmdbShowId={p.tmdbShowId}
          posterPath={p.posterPath}
          name={p.showTitle}
          width={46}
          pressable={!!p.posterPressable}
        />
      </View>

      {/* Interactive like bar (published reviews only). Tap the heart to toggle;
          shows liker avatars + count. Drafts pass no reviewId → no bar. */}
      {p.reviewId && (
        <View style={styles.meta}>
          <ReviewLikeBar reviewId={p.reviewId} initialCount={p.likes} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
