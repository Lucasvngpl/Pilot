import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/lib/theme';

type Props = {
  uris?: (string | null | undefined)[];
  count?: number; // how many slots to render (defaults to 4 per spec)
  size?: number;  // diameter per circle
  step?: number;  // horizontal spacing between circle starts (5px overlap when size=15, step=10)
};

// Overlapping circle row, with a background-colored stroke on each so the
// boundary reads even when avatars sit on top of each other.
export function AvatarCluster({ uris = [], count = 4, size = 15, step = 10 }: Props) {
  const { colors } = useTheme();
  const slots = Array.from({ length: count });
  return (
    <View style={{ flexDirection: 'row' }}>
      {slots.map((_, i) => {
        const uri = uris[i];
        const baseStyle = {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          // The stroke separates overlapping avatars by matching the screen
          // behind them (a "cutout"), so it tracks `background`, not a fixed white.
          borderColor: colors.background,
          marginLeft: i === 0 ? 0 : step - size, // negative => overlap
        };
        return uri ? (
          <Image key={i} source={{ uri }} style={baseStyle} />
        ) : (
          <View
            key={i}
            style={[baseStyle, { backgroundColor: i % 2 === 0 ? colors.muted : colors.faint }]}
          />
        );
      })}
    </View>
  );
}
