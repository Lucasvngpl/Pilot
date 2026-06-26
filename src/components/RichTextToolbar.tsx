// RichTextToolbar — the formatting bar (Bold · Italic · Indent · Link · Undo ·
// Redo) shown above the keyboard while editing rich text. Purely presentational:
// it just renders buttons and fires callbacks; all selection/transform logic
// lives in RichTextInput. Bold/Italic are drawn as glyphs (matches Letterboxd);
// indent/link/undo/redo are SVG icons.
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { IndentIcon, LinkIcon, UndoIcon, RedoIcon } from '@/components/icons';

export type RichTextToolbarProps = {
  onBold: () => void;
  onItalic: () => void;
  onIndent: () => void;
  onLink: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function RichTextToolbar({
  onBold, onItalic, onIndent, onLink, onUndo, onRedo, canUndo, canRedo,
}: RichTextToolbarProps) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      <Pressable onPress={onBold} hitSlop={6} style={styles.btn} accessibilityLabel="Bold">
        <Text style={[styles.glyph, { fontFamily: fonts.bold }]}>B</Text>
      </Pressable>
      <Pressable onPress={onItalic} hitSlop={6} style={styles.btn} accessibilityLabel="Italic">
        <Text style={[styles.glyph, styles.italicGlyph]}>I</Text>
      </Pressable>
      <Pressable onPress={onIndent} hitSlop={6} style={styles.btn} accessibilityLabel="Indent">
        <IndentIcon color={colors.ink} size={22} />
      </Pressable>
      <Pressable onPress={onLink} hitSlop={6} style={styles.btn} accessibilityLabel="Insert link">
        <LinkIcon color={colors.ink} size={22} />
      </Pressable>

      <View style={styles.spacer} />

      {/* Undo/redo dim to `faint` when there's nothing to step to, so the bar
          honestly signals the end of the stack. `disabled` also blocks the tap. */}
      <Pressable onPress={onUndo} disabled={!canUndo} hitSlop={6} style={styles.btn} accessibilityLabel="Undo">
        <UndoIcon color={canUndo ? colors.ink : colors.faint} size={22} />
      </Pressable>
      <Pressable onPress={onRedo} disabled={!canRedo} hitSlop={6} style={styles.btn} accessibilityLabel="Redo">
        <RedoIcon color={canRedo ? colors.ink : colors.faint} size={22} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    // `surface` so the bar reads as an elevated control strip; a top hairline
    // separates it from the keyboard/field below.
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      height: 46,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.hairline,
    },
    btn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyph: { fontSize: 18, color: colors.ink },
    italicGlyph: { fontFamily: fonts.semibold, fontStyle: 'italic' },
    spacer: { flex: 1 },
  });
