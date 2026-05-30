import { View, TextInput, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SearchIcon, CloseIcon } from '@/components/icons';
import { colors, fonts, pad } from '@/theme';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  // Override the container layout. The default wrap owns `marginHorizontal: pad`
  // (right for a screen-edge search bar); a parent that already pads its content
  // passes e.g. `{ marginHorizontal: 0 }` so the field doesn't get inset twice.
  style?: StyleProp<ViewStyle>;
};

// Search bar: rounded field with a left search glyph and a clear (×) button that
// appears once there's text. Not TextField — that's a labeled form input with no
// left-icon slot.
export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search shows and people',
  onFocus,
  onBlur,
  style,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <SearchIcon color={colors.faint} size={18} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={onFocus}
        onBlur={onBlur}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <CloseIcon color={colors.faint} size={16} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.field,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginHorizontal: pad,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    padding: 0, // kill RN's default vertical padding so the row stays centered
  },
});
