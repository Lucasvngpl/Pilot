import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '@/theme';

// Tap-to-enlarge avatar lightbox: a dim full-screen scrim with the avatar
// centered. Tap anywhere to dismiss. Modal (not the Sheet overlay) so it covers
// the whole screen incl. the status bar — and it's a one-off viewer, not a sheet
// that needs to stack over another sheet.
export function AvatarViewer({
  uri,
  visible,
  onClose,
}: {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  if (!uri) return null;
  const size = Math.min(width - 72, 320);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.scrim} onPress={onClose}>
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
        />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center' },
});
