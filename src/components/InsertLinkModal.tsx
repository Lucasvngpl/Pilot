// InsertLinkModal — the "Insert link" dialog (link title + URL, Cancel / Add)
// the toolbar's Link button opens. A centered dialog over the composer.
//
// Why an RN <Modal> here (when CLAUDE.md says "sheets are overlays, not Modals"):
// that rule targets Sheet-over-Sheet (iOS can't present one Modal over another).
// This dialog opens over a plain pushed SCREEN, not over another Modal, so the
// standard centered-dialog tool is fine — and Modal gives us a portal above the
// keyboard plus its own keyboard handling for the two fields.
import { useEffect, useState } from 'react';
import {
  Modal, View, Text, Pressable, TextInput, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { fonts, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { normalizeUrl } from '@/lib/markdown';

type Props = {
  visible: boolean;
  // When the link button is pressed with text selected, that text seeds the
  // title field — one less thing to type.
  initialTitle?: string;
  onCancel: () => void;
  // `url` is already normalized (https:// prepended when scheme-less).
  onSubmit: (title: string, url: string) => void;
};

export function InsertLinkModal({ visible, initialTitle = '', onCancel, onSubmit }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [title, setTitle] = useState(initialTitle);
  const [url, setUrl] = useState('');

  // Re-seed the fields each time the dialog opens (the selected text may differ
  // between openings; a stale title from a previous open would be wrong).
  useEffect(() => {
    if (visible) {
      setTitle(initialTitle);
      setUrl('');
    }
  }, [visible, initialTitle]);

  // Add is enabled once there's a URL; if the user gives no title we fall back to
  // showing the URL itself as the link text.
  const trimmedUrl = url.trim();
  const canAdd = trimmedUrl.length > 0;

  const submit = () => {
    if (!canAdd) return;
    const finalUrl = normalizeUrl(trimmedUrl);
    const finalTitle = title.trim() || finalUrl;
    onSubmit(finalTitle, finalUrl);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tap outside the card to dismiss. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />

        <View style={styles.card}>
          <Text style={styles.heading}>Insert link</Text>

          <Text style={styles.fieldLabel}>Link title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What the link says"
            placeholderTextColor={colors.faint}
            autoCapitalize="sentences"
          />

          <Text style={styles.fieldLabel}>URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="pilot.app"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            // Enter on the URL field commits, like tapping Add.
            returnKeyType="done"
            onSubmitEditing={submit}
            // Open focused on the URL — the title is often pre-seeded from the
            // selection, so the URL is the one field the user always must fill.
            autoFocus
          />

          <View style={styles.actions}>
            <Pressable onPress={onCancel} hitSlop={6} style={[styles.actionBtn, styles.cancelBtn]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={!canAdd}
              hitSlop={6}
              style={[styles.actionBtn, styles.addBtn, !canAdd && styles.addBtnDisabled]}
            >
              {/* On the saturated purple Add fill, the label is fixed white. */}
              <Text style={[styles.addText, !canAdd && styles.addTextDisabled]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 20,
    },
    heading: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink, marginBottom: 16 },
    fieldLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginBottom: 6 },
    input: {
      height: 46,
      backgroundColor: colors.field,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: colors.ink,
      marginBottom: 14,
    },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 2 },
    actionBtn: {
      height: 40,
      paddingHorizontal: 18,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtn: { backgroundColor: colors.field },
    cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    addBtn: { backgroundColor: colors.purple },
    addBtnDisabled: { backgroundColor: colors.field },
    addText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
    addTextDisabled: { color: colors.faint },
  });
