// CommentsSection — the flat comment thread + composer for a review or a list
// (PIL-24). Dropped into the bottom of the review-detail and list-detail
// ScrollViews; same component, different target. Reading is public; posting is
// gated behind the per-action login gate (inside usePostComment). Each comment's
// ⋯ opens the shared ContentActionSheet (own → Delete; others → Report / Block).
import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useComments, usePostComment, useDeleteComment } from '@/api/useComments';
import { ContentActionSheet } from '@/components/ContentActionSheet';
import { RichTextInput } from '@/components/RichTextInput';
import { Markdown } from '@/components/Markdown';
import { DotsIcon } from '@/components/icons';
import { timeAgo } from '@/lib/timeAgo';
import { type, pad, fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { CommentTargetType, CommentWithMeta } from '@/types';

type Props = { targetType: CommentTargetType; targetId: string };

export function CommentsSection({ targetType, targetId }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { data: comments, isLoading } = useComments(targetType, targetId);
  const { post } = usePostComment(targetType, targetId);
  const { remove } = useDeleteComment(targetType, targetId);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [menuComment, setMenuComment] = useState<CommentWithMeta | null>(null);

  const list = comments ?? [];
  const canPost = draft.trim().length > 0 && !posting;

  const onPost = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    // Keep the text until the post lands (the gate may raise a login sheet); only
    // clear on success so a dismissed login / failure doesn't lose what they typed.
    const ok = await post(body);
    if (ok) setDraft('');
    setPosting(false);
  };

  const confirmDelete = (id: string) => {
    Alert.alert('Delete comment?', 'This permanently deletes your comment.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[type.subhead, styles.header, { color: colors.ink }]}>
        Comments{list.length > 0 ? ` (${list.length})` : ''}
      </Text>

      {/* Composer — the PIL-22 rich-text editor drives the comment body (bold /
          italic / indent / link, toolbar docked above the keyboard), stored as the
          SAME markdown subset as reviews. RichTextInput is a full-width block, so
          the Post button sits beneath it, right-aligned. */}
      <View style={styles.composer}>
        <RichTextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a comment…"
          minHeight={44}
        />
        <Pressable
          onPress={onPost}
          disabled={!canPost}
          style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
        >
          {/* white label on the saturated purple fill (the one valid use of `white`). */}
          <Text style={[styles.postLabel, { color: colors.white }]}>Post</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <Text style={styles.muted}>Loading comments…</Text>
      ) : list.length === 0 ? (
        <Text style={styles.muted}>No comments yet. Start the conversation.</Text>
      ) : (
        list.map((c) => (
          <CommentRow
            key={c.id}
            comment={c}
            // Optimistic rows (temp-…) aren't real yet → no ⋯ until they land.
            onMenu={c.id.startsWith('temp-') ? undefined : () => setMenuComment(c)}
          />
        ))
      )}

      {/* One shared menu, retargeted per tapped comment. Own → Delete; others →
          Report comment / Block user (handled inside ContentActionSheet). */}
      <ContentActionSheet
        visible={!!menuComment}
        onClose={() => setMenuComment(null)}
        target={{
          type: 'comment',
          id: menuComment?.id ?? '',
          userId: menuComment?.user_id ?? '',
        }}
        ownActions={
          menuComment
            ? [{ label: 'Delete comment', destructive: true, onPress: () => confirmDelete(menuComment.id) }]
            : []
        }
      />
    </View>
  );
}

function CommentRow({ comment, onMenu }: { comment: CommentWithMeta; onMenu?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.push(`/user/${comment.user_id}` as any)} hitSlop={4}>
        {comment.avatar_url ? (
          <Image source={{ uri: comment.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
        )}
      </Pressable>
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <Text style={[type.reviewUser, { color: colors.ink, flex: 1 }]} numberOfLines={1}>
            {comment.display_name ?? comment.username}
          </Text>
          <Text style={styles.time}>{timeAgo(comment.created_at)}</Text>
          {onMenu && (
            <Pressable onPress={onMenu} hitSlop={8} style={{ marginLeft: 10 }}>
              <DotsIcon color={colors.faint} size={16} />
            </Pressable>
          )}
        </View>
        {/* Comment body is the markdown subset (same as reviews) → render it,
            don't print raw `**`/`[..](..)`. */}
        <Markdown text={comment.body} style={[type.reviewBody, { color: colors.ink, marginTop: 2 }]} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { paddingTop: 8 },
  header: { paddingHorizontal: pad, paddingTop: 20, paddingBottom: 12 },

  composer: {
    paddingHorizontal: pad,
    paddingBottom: 16,
  },
  postBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    // RichTextInput is full-width above; keep Post compact and right-aligned.
    alignSelf: 'flex-end',
  },
  postBtnDisabled: { opacity: 0.4 },
  postLabel: { fontFamily: fonts.semibold, fontSize: 15 },

  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    paddingHorizontal: pad,
    paddingVertical: 8,
  },

  row: { flexDirection: 'row', gap: 10, paddingHorizontal: pad, paddingVertical: 10 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  rowBody: { flex: 1 },
  rowHead: { flexDirection: 'row', alignItems: 'center' },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.faint, marginLeft: 8 },
});
