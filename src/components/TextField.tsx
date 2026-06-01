// TextField — labeled form input (email, password, username, review body); supports multiline/text-area mode and a right-accessory slot.
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  // Optional accessory rendered to the right of the label (e.g. "Forgot password?").
  rightAccessory?: React.ReactNode;
  // Multiline grows the input into a text area (review body etc.).
  multiline?: boolean;
  editable?: boolean; // false = read-only (e.g. username), dimmed text
  maxLength?: number;
};

export function TextField({
  label, value, onChangeText, placeholder,
  secureTextEntry, keyboardType, autoCapitalize, rightAccessory, multiline,
  editable = true, maxLength,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {rightAccessory}
      </View>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline, editable === false && styles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={!secureTextEntry}
        editable={editable}
        maxLength={maxLength}
        multiline={multiline}
        scrollEnabled={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { marginBottom: 16 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  input: {
    height: 52,
    backgroundColor: colors.field,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  // Grows the field into a text area; drops the fixed height.
  inputMultiline: {
    height: undefined,
    minHeight: 120,
    paddingTop: 14,
    paddingBottom: 14,
  },
  inputDisabled: { color: colors.muted },
});
