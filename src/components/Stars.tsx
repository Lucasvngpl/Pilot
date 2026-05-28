import { View } from 'react-native';
import { StarIcon } from '@/components/icons';
import { colors } from '@/theme';

type Props = {
  value: number;       // 0..total, half-step
  total?: number;      // default 5
  size?: number;       // default 24
  color?: string;      // fill color
  emptyColor?: string; // outline color
};

// Shared half-star row renderer. Read-only — gesture handling stays in
// RatingPicker. Each star is an empty outline of `emptyColor` with a `color`
// fill overlaid and clipped to 0 / size/2 / size via overflow:hidden.
export function Stars({
  value,
  total = 5,
  size = 24,
  color = colors.purple,
  emptyColor = colors.hairline,
}: Props) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: total }).map((_, i) => (
        <Star
          key={i}
          index={i}
          value={value}
          size={size}
          color={color}
          emptyColor={emptyColor}
        />
      ))}
    </View>
  );
}

function Star({
  index, value, size, color, emptyColor,
}: {
  index: number;
  value: number;
  size: number;
  color: string;
  emptyColor: string;
}) {
  const full = value >= index + 1;
  const half = !full && value >= index + 0.5;
  const fillWidth = full ? size : half ? size / 2 : 0;

  return (
    <View style={{ width: size, height: size }}>
      <StarIcon color={emptyColor} size={size} />
      {fillWidth > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0, top: 0,
            height: '100%',
            width: fillWidth,
            overflow: 'hidden',
          }}
          pointerEvents="none"
        >
          <StarIcon color={color} size={size} />
        </View>
      )}
    </View>
  );
}
