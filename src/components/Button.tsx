import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { fonts } from '@/theme';
import { useTheme } from '@/lib/theme';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

// Primary = ink fill / inverted text. Disabled primary = field fill / faint text
// (per spec — the disabled state of the Log-in button).
// Secondary = surface fill / hairline border / ink text.
//
// Dark-mode note: the fill (`ink`) and the text must INVERT together. `ink` flips
// to light in dark mode, so the label tracks `background` (flips to dark) — not a
// fixed white, which would vanish on the now-light fill. Likewise the secondary
// fill is `surface` (flips), not `white`, so its `ink` text stays legible.
export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? (isDisabled ? colors.field : colors.ink)
      : colors.surface;
  const fg =
    variant === 'primary'
      ? (isDisabled ? colors.faint : colors.background)
      : colors.ink;
  const border = variant === 'secondary' ? colors.hairline : undefined;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={[
        styles.button,
        { backgroundColor: bg },
        border ? { borderWidth: 1, borderColor: border } : null,
      ]}
    >
      {loading
        ? <ActivityIndicator color={fg} />
        : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
  },
});
