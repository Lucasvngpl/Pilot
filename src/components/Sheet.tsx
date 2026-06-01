import { useEffect, useRef, useState } from 'react';
import {
  Animated, View, Pressable, StyleSheet, BackHandler, Keyboard, Platform,
  type KeyboardEvent,
} from 'react-native';
import { type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Bottom sheet built WITHOUT RN Modal — a positioned overlay that animates in.
//
// Why not Modal: iOS won't reliably stack one Modal over another, so a Modal
// sheet can't open a second sheet (e.g. LoginSheet over ShowActionSheet for a
// per-action auth gate). As plain overlays, sheets stack by render order —
// LoginSheet (mounted at root in RequireAuthProvider, after the routes) sits
// above any in-route sheet, and the underlying sheet stays mounted with its
// state intact through the login round-trip.
//
// Scrim + sheet are SIBLINGS: a tap on the sheet never bubbles to the scrim,
// so no responder hack is needed and child drags (RatingPicker) claim touches
// normally — fixing the old inner-Pressable interception.
export function Sheet({ visible, onClose, children, height = 560 }: Props) {
  const styles = useThemedStyles(makeStyles);
  const progress = useRef(new Animated.Value(0)).current;
  // Lift the sheet above the on-screen keyboard. The sheet is pinned to
  // bottom:0, so without this the keyboard covers its lower half (the inputs +
  // submit button on the LoginSheet). Stays 0 when no keyboard shows → a no-op
  // for the input-less sheets (action menus, rating picker).
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  // Stay mounted through the close animation, then unmount.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: true })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible, progress]);

  // Android hardware back closes the (top-most mounted) sheet.
  useEffect(() => {
    if (!mounted) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [mounted, onClose]);

  // Track the keyboard so the sheet rides up with it. iOS exposes the *Will*
  // events (fire in lockstep with the system animation curve); Android only the
  // *Did* events. `endCoordinates.height` is how much the keyboard occupies.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) =>
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    const onHide = (e: KeyboardEvent) =>
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: true,
      }).start();
    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => { s1.remove(); s2.remove(); };
  }, [keyboardOffset]);

  if (!mounted) return null;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedPressable style={[styles.scrim, { opacity: progress }]} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          // Two stacked translates: the open/close slide, then the keyboard lift
          // (negative = upward). Both run on the native driver.
          { height, transform: [{ translateY }, { translateY: Animated.multiply(keyboardOffset, -1) }] },
        ]}
      >
        <View style={styles.grabber} />
        {children}
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    // `surface` (not `background`): a sheet is an elevated panel that should sit
    // a touch lighter than the screen in dark mode so it lifts off the scrim.
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
  grabber: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: colors.hairline,
    alignSelf: 'center',
    marginBottom: 16,
  },
});
