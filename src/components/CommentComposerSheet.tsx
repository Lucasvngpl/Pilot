// CommentComposerSheet — the full-screen comment composer (Record Club-style):
// a Cancel · "Comment" · Submit header over a plain, autofocused text field.
// Plain text by design — comments dropped the markdown toolbar (see CommentsSection),
// so there's no "**" to see while typing. Built on the shared Sheet overlay with
// liftOnKeyboard OFF (a tall sheet must NOT ride up with the keyboard) and stacks
// under the root LoginSheet, so the per-action auth gate still works from inside it.
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { fonts, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (body: string) => void; // parent posts + toasts + closes on success
  submitting?: boolean;
  initialText?: string;             // e.g. "@username " for a reply
};

export function CommentComposerSheet({ visible, onClose, onSubmit, submitting, initialText = '' }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [text, setText] = useState(initialText);

  // Reseed the field ONLY when the sheet opens (visible flips true) — a reply
  // prefills "@user ", a fresh comment opens empty — so live typing isn't clobbered.
  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const canSubmit = text.trim().length > 0 && !submitting;

  return (
    // ~88% of the screen → a tall, near-full sheet like the reference composer.
    <Sheet visible={visible} onClose={onClose} height={Math.round(height * 0.88)} liftOnKeyboard={false}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>Comment</Text>
        <Pressable onPress={() => canSubmit && onSubmit(text.trim())} hitSlop={8} disabled={!canSubmit}>
          <Text style={[styles.submit, { color: canSubmit ? colors.purple : colors.faint }]}>Submit</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Add a comment…"
        placeholderTextColor={colors.faint}
        multiline
        autoFocus
        textAlignVertical="top"
      />
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  cancel: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  submit: { fontFamily: fonts.semibold, fontSize: 16 },
  // flex:1 so the field fills the rest of the tall sheet; text starts at the top
  // (textAlignVertical) so it stays above the keyboard with no lift.
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.ink,
    paddingHorizontal: pad,
    paddingTop: 16,
  },
});
