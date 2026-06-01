import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet,
  type GestureResponderEvent, type LayoutChangeEvent,
} from 'react-native';
import { Stars } from '@/components/Stars';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  value: number | null;
  onChange: (next: number | null) => void;
};

const STAR_SIZE = 36;

// Drag-to-rate with half-star precision (Letterboxd-style).
// Visual rendering is delegated to <Stars>; this component owns gesture state.
//   - Touch any point in the row → preview that value.
//   - Drag horizontally → preview updates continuously (0.5 increments).
//   - Drag past the left edge → preview = 0 → release clears the rating.
//   - Release → commit preview to onChange.
export function RatingPicker({ value, onChange }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [rowWidth, setRowWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  // Did this gesture actually touch a measured row? Guards the rowWidth=0
  // race: a tap that lands before onLayout fires must NOT commit (it would
  // commit null → DELETE an existing rating).
  const interacted = useRef(false);

  const display = preview ?? value ?? 0;

  // 10 half-star zones across the row width. ceil so the first pixel maps
  // to 0.5, not 0. x = 0 stays at 0 → clear.
  const valueFromX = (x: number): number => {
    const clamped = Math.max(0, Math.min(x, rowWidth));
    const halfIndex = Math.ceil((clamped / rowWidth) * 10);
    return halfIndex / 2;
  };

  const onTouch = (e: GestureResponderEvent) => {
    if (rowWidth <= 0) return; // layout not measured yet — ignore the touch
    interacted.current = true;
    const v = valueFromX(e.nativeEvent.locationX);
    setPreview(v === 0 ? null : v);
  };

  const onEnd = () => {
    if (!interacted.current) {
      // Never got a valid touch (e.g. tapped before layout) — don't commit.
      setPreview(null);
      return;
    }
    interacted.current = false;
    onChange(preview);
    setPreview(null);
  };

  return (
    <View style={styles.wrap}>
      <View
        style={styles.row}
        onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderRelease={onEnd}
        onResponderTerminate={onEnd}
      >
        <Stars value={display} size={STAR_SIZE} color={colors.purple} />
      </View>
      <Text style={styles.caption}>Your rating</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 18 },
  row: { flexDirection: 'row' },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 8,
  },
});
