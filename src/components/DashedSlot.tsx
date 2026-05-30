import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

type Props = { n: number; width: number };

// An empty "Top 4" favorite slot — dashed outline with its position number.
// Width is passed by the parent (it divides the row into 4 across), height keeps
// the spec's 98:132 poster-ish ratio.
//
// Note: RN's borderStyle:'dashed' renders a dashed border but can't control the
// dash/gap lengths the spec calls for (dash 5 / gap 4). Acceptable for v1;
// upgrade to a react-native-svg dashed rect if the fidelity ever matters.
export function DashedSlot({ n, width }: Props) {
  const height = Math.round(width * 1.347); // 132 / 98 ≈ 1.347
  return (
    <View style={[styles.slot, { width, height }]}>
      <Text style={styles.num}>{n}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    borderRadius: 8,
    backgroundColor: colors.field,
    borderWidth: 1.5,
    borderColor: colors.dashStroke,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontFamily: fonts.bold, fontSize: 18, color: colors.dashStroke },
});
