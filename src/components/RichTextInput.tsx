// RichTextInput — the ONE reusable rich-text editor: a multiline field plus a
// formatting toolbar (Bold · Italic · Indent · Link · Undo · Redo) and the
// Insert-link dialog. Drop-in for a multiline <TextField>: same value/onChangeText
// contract, so wiring it into a composer is a one-line swap.
//
// Three RN concepts this leans on (React-but-not-RN notes for the reader):
//  - InputAccessoryView (iOS only): a view the OS docks ABOVE the keyboard and
//    ties to a TextInput by a shared id (`inputAccessoryViewID` ↔ `nativeID`).
//    It is part of the keyboard's frame, so KeyboardAvoidingView already accounts
//    for its height. Android/web have no equivalent → we render a static bar
//    pinned to the top of the field there (the "sensible fallback").
//  - selection: the TextInput's `{start,end}` character range. The toolbar needs
//    it to know what to wrap/indent. We read it live from `onSelectionChange`
//    into a ref, and only *control* it for a single render right after a
//    programmatic edit (so the caret follows the change) — never during typing,
//    which is the classic cause of Android cursor-jump.
//  - the history stack gives the toolbar's Undo/Redo. Typing coalesces into one
//    entry per ~burst; each toolbar action is its own discrete step.
import { useEffect, useId, useRef, useState, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Platform, InputAccessoryView,
  type NativeSyntheticEvent, type TextInputSelectionChangeEventData,
} from 'react-native';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { RichTextToolbar } from '@/components/RichTextToolbar';
import { InsertLinkModal } from '@/components/InsertLinkModal';
import {
  toggleWrap, toggleBlockquote, insertLink, type Edit, type Selection,
} from '@/lib/markdown';

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  minHeight?: number;
  // Optional accessory to the right of the label (e.g. the bio char counter).
  rightAccessory?: React.ReactNode;
};

// Coalesce window: consecutive keystrokes within this many ms collapse into one
// undo step, so Undo removes a word-ish burst rather than a single character.
const TYPE_COALESCE_MS = 700;

export function RichTextInput({
  label, value, onChangeText, placeholder, maxLength, minHeight = 120, rightAccessory,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  // A unique accessory id per instance (two rich fields on one screen mustn't
  // share a toolbar). Strip ':' from React's useId — some RN versions dislike it
  // in a nativeID.
  const accessoryID = `rti-${useId().replace(/:/g, '')}`;

  // Live cursor/selection, kept in a ref (not state) so cursor moves don't
  // re-render the whole field. Transforms read this.
  const selectionRef = useRef<Selection>({ start: 0, end: 0 });
  // Set ONLY for the one render after a programmatic edit, to push the caret to
  // the right spot; cleared on the next selection event → field goes back to
  // uncontrolled-selection (no Android jump while typing).
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');

  // ----- Undo/redo history --------------------------------------------------
  // entries[index] is the current state. lastKind drives typing-coalesce.
  const history = useRef<{ entries: Edit[]; index: number; lastKind: 'type' | 'cmd' | 'init'; lastAt: number }>({
    entries: [{ text: value, selection: { start: 0, end: 0 } }],
    index: 0,
    lastKind: 'init',
    lastAt: 0,
  });
  // The history lives in a ref (mutable, no churn). canUndo/canRedo are mirrored
  // into STATE — derived from the ref at mutation time, not read during render —
  // so the toolbar re-renders when they change without touching ref.current mid-render.
  const [{ canUndo, canRedo }, setUndoState] = useState({ canUndo: false, canRedo: false });
  const syncUndoState = useCallback(() => {
    const hist = history.current;
    setUndoState({ canUndo: hist.index > 0, canRedo: hist.index < hist.entries.length - 1 });
  }, []);
  // Mirrors the value we last drove ourselves, to tell our own edits apart from
  // an EXTERNAL value change (e.g. a composer seeding an edit) — see the effect.
  const lastKnownRef = useRef(value);

  const commit = useCallback((edit: Edit, kind: 'type' | 'cmd') => {
    const hist = history.current;
    const now = Date.now();
    const coalesce =
      kind === 'type' &&
      hist.lastKind === 'type' &&
      now - hist.lastAt < TYPE_COALESCE_MS &&
      hist.index === hist.entries.length - 1;
    if (coalesce) {
      hist.entries[hist.index] = edit; // replace the in-progress typing burst
    } else {
      hist.entries = hist.entries.slice(0, hist.index + 1); // drop any redo tail
      hist.entries.push(edit);
      hist.index = hist.entries.length - 1;
    }
    hist.lastKind = kind;
    hist.lastAt = now;
    syncUndoState();
  }, [syncUndoState]);

  // Push a programmatic edit into the field: remember it as ours, move the caret,
  // and notify the parent.
  const applyEdit = useCallback((edit: Edit) => {
    lastKnownRef.current = edit.text;
    selectionRef.current = edit.selection;
    setForcedSelection(edit.selection);
    onChangeText(edit.text);
  }, [onChangeText]);

  // If the parent swaps `value` from underneath us (edit composers seed the body
  // AFTER mount), rebaseline history to that value so Undo can't step back into
  // the pre-seed empty state. Our own edits set lastKnownRef first, so they don't
  // trip this.
  useEffect(() => {
    if (value !== lastKnownRef.current) {
      lastKnownRef.current = value;
      history.current = {
        entries: [{ text: value, selection: selectionRef.current }],
        index: 0,
        lastKind: 'init',
        lastAt: 0,
      };
      syncUndoState();
    }
  }, [value, syncUndoState]);

  const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    selectionRef.current = e.nativeEvent.selection;
    // Release the forced selection so the field is uncontrolled again.
    if (forcedSelection) setForcedSelection(undefined);
  };

  const handleChangeText = (t: string) => {
    lastKnownRef.current = t;
    onChangeText(t);
    commit({ text: t, selection: selectionRef.current }, 'type');
  };

  // ----- Toolbar actions ----------------------------------------------------
  const runTransform = (fn: (text: string, sel: Selection) => Edit) => {
    const edit = fn(value, selectionRef.current);
    applyEdit(edit);
    commit(edit, 'cmd');
    inputRef.current?.focus(); // a toolbar tap can blur on Android — keep editing
  };

  const onBold = () => runTransform((t, s) => toggleWrap(t, s, '**'));
  const onItalic = () => runTransform((t, s) => toggleWrap(t, s, '*'));
  const onIndent = () => runTransform(toggleBlockquote);

  const onOpenLink = () => {
    const { start, end } = selectionRef.current;
    // Pre-fill the title with any selected text.
    setLinkTitle(value.slice(Math.min(start, end), Math.max(start, end)));
    setLinkOpen(true);
  };
  const onSubmitLink = (title: string, url: string) => {
    setLinkOpen(false);
    const edit = insertLink(value, selectionRef.current, title, url);
    applyEdit(edit);
    commit(edit, 'cmd');
    inputRef.current?.focus();
  };

  const onUndo = () => {
    const hist = history.current;
    if (hist.index <= 0) return;
    hist.index -= 1;
    applyEdit(hist.entries[hist.index]);
    hist.lastKind = 'cmd';
    syncUndoState();
  };
  const onRedo = () => {
    const hist = history.current;
    if (hist.index >= hist.entries.length - 1) return;
    hist.index += 1;
    applyEdit(hist.entries[hist.index]);
    hist.lastKind = 'cmd';
    syncUndoState();
  };

  const toolbar = (
    <RichTextToolbar
      onBold={onBold}
      onItalic={onItalic}
      onIndent={onIndent}
      onLink={onOpenLink}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
    />
  );

  const isIOS = Platform.OS === 'ios';

  return (
    <View style={styles.wrap}>
      {label != null && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {rightAccessory}
        </View>
      )}

      {/* Android/web have no InputAccessoryView → a static bar pinned above the
          field is the fallback (always visible while editing). */}
      {!isIOS && toolbar}

      <TextInput
        ref={inputRef}
        style={[styles.input, { minHeight }]}
        value={value}
        onChangeText={handleChangeText}
        onSelectionChange={onSelectionChange}
        selection={forcedSelection}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={maxLength}
        multiline
        scrollEnabled
        textAlignVertical="top"
        inputAccessoryViewID={isIOS ? accessoryID : undefined}
      />

      {/* iOS: the toolbar docks above the keyboard. It re-renders with this
          component, so its callbacks always close over the latest selection. */}
      {isIOS && (
        <InputAccessoryView nativeID={accessoryID}>{toolbar}</InputAccessoryView>
      )}

      <InsertLinkModal
        visible={linkOpen}
        initialTitle={linkTitle}
        onCancel={() => setLinkOpen(false)}
        onSubmit={onSubmitLink}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { marginBottom: 16 },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
    input: {
      backgroundColor: colors.field,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 14,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: colors.ink,
    },
  });
