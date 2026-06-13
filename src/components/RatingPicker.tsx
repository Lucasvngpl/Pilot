import { useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Stars } from '@/components/Stars';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  value: number | null;
  onChange: (next: number | null) => void;
};

const STAR_SIZE = 36;
const TOTAL = 5;

// Tap-to-rate (whole star) + drag-to-rate (half-star), Letterboxd-style.
//
// Why react-native-gesture-handler and NOT the legacy RN responder system: the
// screen's iOS swipe-back is a native UIScreenEdgePanGestureRecognizer (owned by
// react-native-screens) that the legacy responder can't coordinate with — so a
// leftward drag on the stars used to get stolen by UIKit and pop the page. An RNGH
// gesture participates in UIKit's recognizer arbitration: a touch that *begins on
// the stars* (centered, ~106px in) is claimed here, so the edge recognizer never
// arms (UIKit only arms it at touch-DOWN within the left edge). The empty left edge
// still swipes back. So the two coexist — and it's "who owns the touch-down", not
// fragile "how wide is the edge zone" pixel math.
//
//   • Tap the Nth star  → N whole stars. Tapping the current whole value clears it.
//   • Drag horizontally → half-star precision (0.5 steps); drag to the far left clears.
export function RatingPicker({ value, onChange }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const [rowWidth, setRowWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  // Latest dragged value, read at release. A ref (not the `preview` state) so the
  // gesture's onEnd never reads a stale closure value.
  const previewRef = useRef<number | null>(null);
  // Did the drag produce a valid update on a measured row? Guards two things: the
  // rowWidth=0 race (a gesture before onLayout must not commit) and a pan that
  // activates but never updates (don't commit a stale value).
  const dragged = useRef(false);

  const display = preview ?? value ?? 0;

  // Drag: 10 half-star zones across the row width. ceil so the first pixel maps to
  // 0.5, not 0; x at the far left stays 0 → clear.
  const valueFromX = (x: number): number => {
    const clamped = Math.max(0, Math.min(x, rowWidth));
    const halfIndex = Math.ceil((clamped / rowWidth) * 10);
    return halfIndex / 2;
  };

  // Tap: which star (0-based) the x falls on. Stars are gapless STAR_SIZE-wide
  // boxes (see Stars.tsx), so this is just integer division — independent of the
  // measured rowWidth.
  const starIndexFromX = (x: number): number =>
    Math.max(0, Math.min(Math.floor(x / STAR_SIZE), TOTAL - 1));

  // Pan = half-star drag. activeOffsetX so it only claims a real horizontal drag (a
  // still finger stays a tap); failOffsetY so a vertical drag yields to the page's
  // scroll instead of being captured here.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => { dragged.current = false; })
    .onUpdate((e) => {
      if (rowWidth <= 0) return;
      dragged.current = true;
      const v = valueFromX(e.x); // e.x is local to the GestureDetector's view
      previewRef.current = v === 0 ? null : v;
      setPreview(previewRef.current);
    })
    .onEnd(() => {
      if (!dragged.current) return;
      onChange(previewRef.current);
    })
    .onFinalize(() => { dragged.current = false; setPreview(null); });

  // Tap = whole star. maxDistance keeps a travelling finger from counting as a tap
  // (the Pan wins instead). Tapping the current whole value again clears it.
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(STAR_SIZE / 2)
    .onEnd((e, success) => {
      if (!success || rowWidth <= 0) return;
      const whole = starIndexFromX(e.x) + 1;
      onChange(value !== null && value === whole ? null : whole); // tap current → clear
    });

  // Exclusive: a genuine drag activates the Pan; otherwise the Tap fires on release.
  // Exactly one commits per interaction, so they can't double-fire.
  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <View style={styles.wrap}>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.row}
          onLayout={(e: LayoutChangeEvent) => setRowWidth(e.nativeEvent.layout.width)}
        >
          <Stars value={display} size={STAR_SIZE} color={colors.purple} />
        </View>
      </GestureDetector>
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
