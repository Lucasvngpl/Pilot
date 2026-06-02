import { Pressable, View, Text, StyleSheet } from 'react-native';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type IconComponent = React.ComponentType<{ color?: string; size?: number }>;

type Props = {
  Icon: IconComponent;
  label: string;
  active: boolean;
  onPress: () => void;
};

// A single status affordance: circular icon over a small label.
// Active = purple fill + white icon. Inactive = field fill + muted icon.
// Spec mirrors Record Club's pills (image 2: filled purple "Listened" pill).
export function StatusPill({ Icon, label, active, onPress }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.wrap} hitSlop={4}>
      <View style={[styles.circle, active ? styles.active : styles.inactive]}>
        <Icon color={active ? colors.white : colors.muted} size={22} />
      </View>
      <Text style={[styles.label, { color: active ? colors.ink : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // Size to content (NOT flex:1) so the row can center the pills as a group — with
  // flex:1, two pills each fill half the row and drift to the quarter points.
  wrap: { alignItems: 'center', gap: 8 },
  circle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  active:   { backgroundColor: colors.purple },
  inactive: { backgroundColor: colors.field },
  label: { fontFamily: fonts.medium, fontSize: 14 },
});
