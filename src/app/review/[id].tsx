// /review/[id] — one review read in full. Letterboxd-style: a full-bleed show
// backdrop banner under the status bar, the show poster (tap → show page), the
// reviewer's avatar + name, the show name + scope, stars, the date, and the
// whole untruncated body. Reached by tapping a review row anywhere; PUBLISHED
// reviews only (drafts open in the composer instead — see useReviewDetail).
import { useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useReviewDetail } from '@/api/useReviewDetail';
import { useDeleteReview } from '@/api/useReviewMutations';
import { Poster } from '@/components/Poster';
import { Stars } from '@/components/Stars';
import { Skeleton } from '@/components/Skeleton';
import { ContentActionSheet } from '@/components/ContentActionSheet';
import { CommentsSection } from '@/components/CommentsSection';
import { ChevronLeftIcon, DotsIcon, ShareIcon } from '@/components/icons';
import { ReviewLikeBar } from '@/components/LikeBar';
import { shareReview } from '@/lib/share';
import { type, pad, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { formatScope, tmdbImage } from '@/types';

const HERO_H = 220; // backdrop banner height (below the status-bar inset)

export default function ReviewScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: review, isLoading } = useReviewDetail(id);
  const { remove } = useDeleteReview();
  const [menuOpen, setMenuOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const heroHeight = HERO_H + insets.top;
  // Scope line ("Season 3" / "Season 2 · E5"), or undefined for a whole-show review.
  const scopeLine = review ? formatScope(review.season_number, review.episode_number) : undefined;

  const onDelete = () => {
    if (!review) return;
    Alert.alert('Delete review?', 'This permanently deletes your review.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(review.id, review.tmdb_show_id);
            router.back(); // the review no longer exists — leave the page
          } catch (e) {
            Alert.alert("Couldn't delete", e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  // White controls over the dark banner: back (always), a centered "Review"
  // title, and on the right Share (anyone, once loaded) + ⋯ (once loaded → own
  // review: Edit/Delete; others' review: Report/Block — ContentActionSheet picks).
  // The title is absolutely positioned so it stays centered no matter how many
  // buttons flank it. Padded below the notch since the banner is full-bleed.
  const controls = (
    <View style={[styles.controls, { paddingTop: insets.top + 6 }]}>
      {/* pointerEvents none → taps fall through to the buttons beneath. */}
      <View pointerEvents="none" style={[styles.titleWrap, { top: insets.top + 6 }]}>
        <Text style={[type.subhead, styles.controlTitle]}>Review</Text>
      </View>

      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.controlBtn}>
        <ChevronLeftIcon color={colors.white} size={26} />
      </Pressable>

      <View style={styles.controlsRight}>
        {review && (
          <Pressable onPress={() => shareReview(review)} hitSlop={10} style={styles.controlBtn}>
            <ShareIcon color={colors.white} size={22} />
          </Pressable>
        )}
        {review && (
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.controlBtn}>
            <DotsIcon color={colors.white} size={22} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Light status-bar icons over the dark banner. */}
      <StatusBar style="light" />

      {/* Backdrop hero. Falls back to a solid ink block when the show has no
          backdrop, so white controls stay legible and the layout doesn't jump. */}
      <View style={[styles.hero, { height: heroHeight }]}>
        {review?.backdropPath && (
          <Image
            source={{ uri: tmdbImage(review.backdropPath, 'w780')! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        )}
        <View style={styles.scrim} />
        {controls}
      </View>

      {isLoading ? (
        <LoadingBody />
      ) : !review ? (
        <Text style={styles.notFound}>Review not found.</Text>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          // iOS: lift content above the keyboard so the comment composer near the
          // bottom isn't covered while typing.
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.topBlock}>
            <View style={styles.topText}>
              {/* Reviewer identity */}
              <View style={styles.reviewer}>
                {review.avatar_url ? (
                  <Image source={{ uri: review.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
                )}
                <Text style={[type.reviewUser, { color: colors.ink }]} numberOfLines={1}>
                  {review.display_name ?? review.username}
                </Text>
              </View>

              {/* Show name + scope (e.g. "Season 3") */}
              <Text style={[type.reviewTitle, { color: colors.ink, marginTop: 12 }]}>
                {review.showName}
              </Text>
              {scopeLine && (
                <Text style={[type.reviewSeason, { color: colors.muted, marginTop: 2 }]}>{scopeLine}</Text>
              )}

              {/* Stars (omitted when the reviewer left no rating for this scope).
                  Coerce null → 0 so the comparison and <Stars value> stay numeric. */}
              {(review.rating ?? 0) > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Stars value={review.rating ?? 0} size={16} color={colors.gold} />
                </View>
              )}

              <Text style={[type.reviewSeason, { color: colors.faint, marginTop: 8 }]}>
                {formatReviewed(review.created_at)}
              </Text>
            </View>

            {/* The show poster — the way back into the show, per the request. */}
            <Poster
              tmdbShowId={review.tmdb_show_id}
              posterPath={review.posterPath}
              name={review.showName}
              width={92}
            />
          </View>

          {/* The full body — no truncation here (that's the whole point of the
              page). Honor the spoiler flag with the same tap-to-reveal gate the
              row uses, even though you navigated here deliberately. */}
          <View style={styles.bodyWrap}>
            {review.contains_spoilers && !revealed ? (
              <Pressable style={styles.spoiler} onPress={() => setRevealed(true)}>
                <Text style={[type.reviewBody, styles.spoilerText]}>
                  This review may contain spoilers. Tap to reveal.
                </Text>
              </Pressable>
            ) : (
              <Text style={[type.reviewBody, styles.body]}>{review.body}</Text>
            )}

            {/* Interactive like bar — tap the heart to toggle; shows liker
                avatars + count, seeded with the count from useReviewDetail. */}
            <View style={styles.meta}>
              <ReviewLikeBar reviewId={review.id} initialCount={review.likes} size={15} />
            </View>
          </View>

          {/* Flat comment thread + composer (public read, login-gated post). */}
          <CommentsSection targetType="review" targetId={review.id} />
        </ScrollView>
      )}

      {/* Banner ⋯ menu. Own review → Edit/Delete (edit reuses the composer with
          the scope locked); others' review → Report/Block. After a block, leave
          the page — the review is now hidden for you. */}
      {review && (
        <ContentActionSheet
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          target={{ type: 'review', id: review.id, userId: review.user_id }}
          ownActions={[
            {
              label: 'Edit review',
              onPress: () =>
                router.push(`/show/${review.tmdb_show_id}/review?reviewId=${review.id}` as any),
            },
            { label: 'Delete review', destructive: true, onPress: onDelete },
          ]}
          onBlocked={() => router.back()}
        />
      )}
    </View>
  );
}

// Skeleton placeholder for the body while the review loads (the hero is already
// painted above, so only the text block needs stand-ins).
function LoadingBody() {
  return (
    <View style={{ paddingHorizontal: pad, paddingTop: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Skeleton width={140} height={16} />
          <Skeleton width={180} height={16} style={{ marginTop: 14 }} />
          <Skeleton width={90} height={14} style={{ marginTop: 10 }} />
        </View>
        <Skeleton width={92} height={138} radius={radius.md} />
      </View>
      <Skeleton width="100%" height={14} style={{ marginTop: 20 }} />
      <Skeleton width="100%" height={14} style={{ marginTop: 8 }} />
      <Skeleton width="80%" height={14} style={{ marginTop: 8 }} />
    </View>
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// reviews.created_at (a full timestamp) → "Reviewed May 31, 2026". Manual format
// rather than toLocaleDateString(opts) — Hermes' Intl can ignore the options and
// return a numeric date (same reason list/[id] hand-formats).
function formatReviewed(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `Reviewed ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  // `bannerInk` (FIXED dark), not `ink`: the hero stays a dark photo area with
  // light controls in BOTH modes — see the same choice in ListBanner.
  hero: { width: '100%', backgroundColor: colors.bannerInk, overflow: 'hidden' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
  },
  controlBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  controlsRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Spans the controls row; centers the title over the flanking buttons.
  titleWrap: { position: 'absolute', left: 0, right: 0, height: 40, alignItems: 'center', justifyContent: 'center' },
  controlTitle: { color: colors.white },

  topBlock: { flexDirection: 'row', paddingHorizontal: pad, paddingTop: 16, gap: 12 },
  topText: { flex: 1 },
  reviewer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14 },

  bodyWrap: { paddingHorizontal: pad, paddingTop: 16 },
  body: { color: colors.ink, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },

  spoiler: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.field,
  },
  spoilerText: { color: colors.muted, fontStyle: 'italic' },

  notFound: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 40,
  },
});
