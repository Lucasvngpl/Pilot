// CommentsSection — the flat comment thread for a review or a list (PIL-24),
// Record Club-style. Dropped into the bottom of the review-detail and list-detail
// ScrollViews; same component, different target. Reading is public; posting is
// gated behind the per-action login gate (inside usePostComment).
//
// Comments are PLAIN TEXT (no markdown toolbar): the composer is a full-screen
// CommentComposerSheet opened from the "Comment as {you}" bar. Each comment shows
// an AUTHOR badge (if by the content's author), Reply (→ @mention), Like + count,
// and a ⋯ (Copy link · own → Delete · others → Report / Block).
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useComments, usePostComment, useDeleteComment, useToggleCommentLike } from '@/api/useComments';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/api/useProfile';
import { useToast } from '@/lib/toast';
import { commentShareUrl } from '@/lib/share';
import { ContentActionSheet } from '@/components/ContentActionSheet';
import { CommentComposerSheet } from '@/components/CommentComposerSheet';
import { DotsIcon, HeartIcon } from '@/components/icons';
import { timeAgo } from '@/lib/timeAgo';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { CommentTargetType, CommentWithMeta } from '@/types';

// `authorId` = the user_id of the review/list this thread hangs off, so a comment
// by that person gets the AUTHOR badge. Derived by the parent screen (no EF change).
type Props = { targetType: CommentTargetType; targetId: string; authorId?: string };

export function CommentsSection({ targetType, targetId, authorId }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const toast = useToast();
  const { user } = useAuth();
  const { data: myProfile } = useProfile(user?.id);
  const { data: comments, isLoading } = useComments(targetType, targetId);
  const { post, isPending } = usePostComment(targetType, targetId);
  const { remove } = useDeleteComment(targetType, targetId);
  const { toggleLike } = useToggleCommentLike(targetType, targetId);

  const [menuComment, setMenuComment] = useState<CommentWithMeta | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSeed, setComposerSeed] = useState(''); // '' = fresh, '@user ' = reply

  const list = comments ?? [];
  const count = list.length;

  const openFresh = () => { setComposerSeed(''); setComposerOpen(true); };
  const openReply = (username: string) => { setComposerSeed(`@${username} `); setComposerOpen(true); };

  const onSubmit = async (body: string) => {
    // post() gates login (LoginSheet stacks over the composer) then inserts.
    const ok = await post(body);
    if (ok) {
      setComposerOpen(false);
      toast.show('Comment posted.');
    }
    // !ok (login dismissed / error) → leave the composer open so nothing's lost.
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete comment?', 'This permanently deletes your comment.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  // Runs synchronously when "Copy link" is tapped — reads menuComment while it's
  // still valid (the menu closes first, but this fires before the re-render).
  const copyMenuCommentLink = () => {
    if (!menuComment) return;
    Clipboard.setStringAsync(commentShareUrl(targetType, targetId, menuComment.id));
    toast.show('Link copied');
  };

  const myName = myProfile?.profile?.display_name ?? myProfile?.profile?.username;

  return (
    <View style={styles.wrap}>
      <Text style={[type.subhead, styles.header, { color: colors.ink }]}>
        {count > 0 ? `${count} ${count === 1 ? 'comment' : 'comments'}` : 'Comments'}
      </Text>

      {isLoading ? (
        <Text style={styles.muted}>Loading comments…</Text>
      ) : count === 0 ? (
        <Text style={styles.muted}>No comments yet. Start the conversation.</Text>
      ) : (
        list.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            isAuthor={!!authorId && c.user_id === authorId}
            // Optimistic rows (temp-…) aren't real yet → no ⋯ / like until they land.
            onMenu={c.id.startsWith('temp-') ? undefined : () => setMenuComment(c)}
            onLike={() => toggleLike(c.id)}
            onReply={() => openReply(c.username)}
          />
        ))
      )}

      {/* "Comment as {you}" bar — tap opens the full-screen composer (Record Club
          pattern). Logged out → a generic prompt; the post still gates login. */}
      <Pressable style={styles.composerBar} onPress={openFresh}>
        {user && myProfile?.profile?.avatar_url ? (
          <Image source={{ uri: myProfile.profile.avatar_url }} style={styles.barAvatar} />
        ) : (
          <View style={[styles.barAvatar, { backgroundColor: colors.hairline }]} />
        )}
        <Text style={styles.barText} numberOfLines={1}>
          {user && myName ? `Comment as ${myName}` : 'Add a comment…'}
        </Text>
      </Pressable>

      <CommentComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={onSubmit}
        submitting={isPending}
        initialText={composerSeed}
      />

      {/* One shared menu, retargeted per tapped comment. Copy link (all) · own →
          Delete · others → Report comment / Block user. */}
      <ContentActionSheet
        visible={!!menuComment}
        onClose={() => setMenuComment(null)}
        target={{ type: 'comment', id: menuComment?.id ?? '', userId: menuComment?.user_id ?? '' }}
        onCopyLink={copyMenuCommentLink}
        ownActions={
          menuComment
            ? [{ label: 'Delete comment', destructive: true, onPress: () => confirmDelete(menuComment.id) }]
            : []
        }
      />
    </View>
  );
}

function CommentRow({
  comment,
  isAuthor,
  onMenu,
  onLike,
  onReply,
}: {
  comment: CommentWithMeta;
  isAuthor: boolean;
  onMenu?: () => void;
  onLike?: () => void;
  onReply?: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      {/* Header: avatar + name (+ AUTHOR badge) on the left, time + ⋯ on the right. */}
      <View style={styles.rowHead}>
        <Pressable onPress={() => router.push(`/user/${comment.user_id}` as any)} hitSlop={4}>
          {comment.avatar_url ? (
            <Image source={{ uri: comment.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
          )}
        </Pressable>
        <View style={styles.nameWrap}>
          <Text style={[type.reviewUser, styles.name, { color: colors.ink }]} numberOfLines={1}>
            {comment.display_name ?? comment.username}
          </Text>
          {isAuthor && (
            <View style={styles.authorPill}>
              <Text style={styles.authorPillText}>AUTHOR</Text>
            </View>
          )}
        </View>
        <Text style={styles.time}>{timeAgo(comment.created_at)}</Text>
        {onMenu && (
          <Pressable onPress={onMenu} hitSlop={8} style={{ marginLeft: 10 }}>
            <DotsIcon color={colors.faint} size={16} />
          </Pressable>
        )}
      </View>

      {/* Body — plain text (comments have no markdown; a stray * never italicizes). */}
      <Text style={[type.reviewBody, styles.body, { color: colors.ink }]}>{comment.body}</Text>

      {/* Actions — Reply · Like · N likes (mirrors the reference row). */}
      <View style={styles.actions}>
        <Pressable onPress={onReply} hitSlop={8}>
          <Text style={styles.actionText}>Reply</Text>
        </Pressable>
        <Pressable onPress={onLike} hitSlop={8} style={styles.likeBtn}>
          <HeartIcon
            color={comment.liked_by_me ? colors.red : colors.faint}
            size={16}
            filled={comment.liked_by_me}
          />
          <Text style={styles.actionText}>Like</Text>
        </Pressable>
        {comment.like_count > 0 && (
          <Text style={styles.likeCount}>
            {comment.like_count} {comment.like_count === 1 ? 'like' : 'likes'}
          </Text>
        )}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { paddingTop: 8 },
  header: { paddingHorizontal: pad, paddingTop: 20, paddingBottom: 12 },

  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingHorizontal: pad,
    paddingVertical: 8,
  },

  // A comment stacks header / body / actions, each spanning full width — the
  // avatar only flanks the NAME, not the whole comment.
  row: { paddingHorizontal: pad, paddingVertical: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  rowHead: { flexDirection: 'row', alignItems: 'center' },
  nameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10, gap: 8 },
  name: { flexShrink: 1 },
  // AUTHOR badge — small uppercase pill on a secondary surface, next to the name.
  authorPill: {
    backgroundColor: colors.surface2,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  authorPillText: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 0.5, color: colors.muted },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginLeft: 8 },

  body: { marginTop: 8 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 10 },
  actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeCount: { fontFamily: fonts.regular, fontSize: 13, color: colors.faint },

  // "Comment as {you}" bar — a hairline-outlined pill (no fill), composited into
  // the layout per the minimal lean; tap opens the full-screen composer.
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: pad,
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  barAvatar: { width: 26, height: 26, borderRadius: 13 },
  barText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
});
