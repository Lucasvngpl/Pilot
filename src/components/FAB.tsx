import { Pressable, StyleSheet, View } from 'react-native';
import { type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { LogIcon } from '@/components/icons';

type Props = { onPress?: () => void };

// 58px purple circle, white +, soft purple shadow.
// Sits above the bottom nav (84px) with 16px spacing.
export function FAB({ onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable onPress={onPress} style={styles.button}>
        <LogIcon color={colors.white} size={28} />
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 20,
    bottom: 100,
  },
  button: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.purple,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8, // android
  },
});
