import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius as themeRadius } from '@/theme';

// A pulsing gray placeholder block — the building block of skeleton screens.
// React Native has no CSS, so the "shimmer" is an opacity loop driven natively
// (cheap: no layout/JS work per frame). Compose these to mirror a screen's real
// layout, so the page's shape is stable the instant you navigate to it instead
// of a spinner on blank. Each instance runs its own loop, but they all mount
// together with the same duration, so they pulse in sync.
export function Skeleton({
  width,
  height,
  radius = themeRadius.md,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  // 0.5 → 1 → 0.5 forever. useNativeDriver so it animates off the JS thread.
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.hairline, opacity }, style]}
    />
  );
}
