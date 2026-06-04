// LikeBar — the like affordance shared by reviews and lists: a tappable heart
// (filled when you've liked it, outline when not) + a capped avatar cluster of
// likers + a count label. Mirrors the show-page VIEWERS row (StatRow): faces +
// a number. `LikeBar` is presentational; `ReviewLikeBar` / `ListLikeBar` are the
// thin wrappers that wire it to the like hooks so callers just drop in an id.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { type, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { HeartIcon } from '@/components/icons';
import { AvatarCluster } from '@/components/AvatarCluster';
import { useReviewLikes, useListLikes, useToggleReviewLike, useToggleListLike } from '@/api/useLikes';
import type { LikeState, ViewerAvatar } from '@/types';

type LikeBarProps = {
  count: number;
  liked: boolean;
  likers: ViewerAvatar[];
  onPress: () => void;
  size?: number; // heart size — 14 on rows, 15 on the detail pages
};

export function LikeBar({ count, liked, likers, onPress, size = 14 }: LikeBarProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  // Liked → solid red heart; not → muted outline. `red` is a FIXED token (reads in
  // both light + dark per the theme rules); `muted` flips with the palette.
  const heartColor = liked ? colors.red : colors.muted;
  // ≤ LIKER_CAP slots; AvatarCluster fills missing avatars with gray placeholders,
  // so a count with not-yet-loaded faces still renders the right number of circles.
  const clusterCount = Math.min(5, count);

  return (
    // alignSelf flex-start so only the heart+cluster+label is tappable, not the
    // whole row width (matters on the wide detail pages). hitSlop keeps it comfy.
    <Pressable onPress={onPress} hitSlop={8} style={styles.bar}>
      <HeartIcon color={heartColor} size={size} filled={liked} />
      {count > 0 && (
        <AvatarCluster uris={likers.map((l) => l.avatar_url)} count={clusterCount} size={16} step={11} />
      )}
      <Text style={[type.reviewMeta, { color: colors.muted }]}>
        {count} {count === 1 ? 'like' : 'likes'}
      </Text>
    </Pressable>
  );
}

// Resolve the hook's data (or a placeholder while it loads) to plain props.
const orEmpty = (s: LikeState | undefined, fallbackCount: number): LikeState =>
  s ?? { count: fallbackCount, likedByMe: false, likers: [] };

// Reviews: seed the count from the content query (`initialCount`) so it shows
// instantly while likers/likedByMe load.
export function ReviewLikeBar({
  reviewId,
  initialCount,
  size,
}: {
  reviewId: string;
  initialCount?: number;
  size?: number;
}) {
  const { data } = useReviewLikes(reviewId, { initialCount });
  const { toggle } = useToggleReviewLike(reviewId);
  const s = orEmpty(data, initialCount ?? 0);
  return <LikeBar count={s.count} liked={s.likedByMe} likers={s.likers} onPress={toggle} size={size} />;
}

// Lists have no pre-fetched count today, so start at 0 and let the hook fill in.
export function ListLikeBar({ listId, size }: { listId: string; size?: number }) {
  const { data } = useListLikes(listId);
  const { toggle } = useToggleListLike(listId);
  const s = orEmpty(data, 0);
  return <LikeBar count={s.count} liked={s.likedByMe} likers={s.likers} onPress={toggle} size={size} />;
}

const makeStyles = (_colors: Palette) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7 },
  });
