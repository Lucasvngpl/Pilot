// toast.tsx — a tiny app-wide confirmation toast (the "Comment posted." /
// "Link copied" bars, Record Club-style). One message at a time: calling show()
// replaces whatever's up and restarts the auto-hide timer. Rendered as an
// absolutely-positioned bar that's the LAST child of the provider, so it paints
// ABOVE the app content (including the bottom nav). NOT a Modal — same reasoning
// as Sheet.tsx (Modals don't stack), so it can float over sheets too.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { CloseIcon } from '@/components/icons';
import { fonts, radius, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type ToastCtx = { show: (message: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

const VISIBLE_MS = 2500; // auto-hide delay
// Sits just above the 84px BottomNav so it mirrors the reference (nav + toast
// above it). Detail screens — where comments live — always show the nav.
const NAV_CLEARANCE = 96;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setMessage(null); });
  }, [opacity]);

  const show = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, VISIBLE_MS);
  }, [opacity, hide]);

  // Clear a pending timer on unmount so it can't fire into a torn-down tree.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {message !== null && <ToastBar message={message} opacity={opacity} onClose={hide} />}
    </Ctx.Provider>
  );
}

function ToastBar({ message, opacity, onClose }:
  { message: string; opacity: Animated.Value; onClose: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    // box-none so taps in the empty side margins fall through to the content.
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { opacity }]}>
      <View style={styles.bar}>
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <CloseIcon color={colors.white} size={18} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: NAV_CLEARANCE, paddingHorizontal: pad },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: colors.purple,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  // white on the saturated purple fill — the one valid use of the fixed white token.
  text: { flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
});
