import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

type Variant = 'primary' | 'secondary';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
};

// Primary = ink fill / white text. Disabled primary = field fill / faint text
// (per spec — the disabled state of the Log-in button).
// Secondary = white fill / hairline border / ink text.
export function Button({ label, onPress, variant = 'primary', disabled, loading }: Props) {
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? (isDisabled ? colors.field : colors.ink)
      : colors.white;
  const fg =
    variant === 'primary'
      ? (isDisabled ? colors.faint : colors.white)
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
