// OAuthButtons — the "Continue with Apple / Google" pair, shared by the onboarding
// sign-in gate and the LoginSheet so there's ONE OAuth entry point (no divergent
// copies of the provider plumbing). Tapping a button runs the PKCE browser flow in
// lib/oauth.ts; on success the session arrives via onAuthStateChange and the parent
// (requireAuth / onboarding) reacts to it. We surface error/cancel via onResult.
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { fonts, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { AppleIcon, GoogleIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth';
import type { OAuthProvider, OAuthResult } from '@/lib/oauth';

type Props = {
  // Called after a provider attempt resolves. On `{}` (success) the session is
  // already landing; on `{ error }` show it; on `{ cancelled }` stay silent.
  onResult?: (result: OAuthResult) => void;
  disabled?: boolean;
};

export function OAuthButtons({ onResult, disabled }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { signInWithOAuth } = useAuth();
  // Track which provider is mid-flight so only its button spins (and both lock).
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  const run = async (provider: OAuthProvider) => {
    if (busy) return;
    setBusy(provider);
    const result = await signInWithOAuth(provider);
    setBusy(null);
    onResult?.(result);
  };

  // Apple sign-in is an iOS convention; on Android/web Google is the norm. We show
  // Apple on iOS + web (web OAuth handles it), Google everywhere. Apple goes first
  // on iOS to match platform expectations.
  const showApple = Platform.OS === 'ios' || Platform.OS === 'web';

  const appleBtn = showApple ? (
    <ProviderButton
      key="apple"
      label="Continue with Apple"
      icon={<AppleIcon color={colors.ink} size={18} />}
      loading={busy === 'apple'}
      disabled={disabled || (busy !== null && busy !== 'apple')}
      onPress={() => run('apple')}
      styles={styles}
    />
  ) : null;

  const googleBtn = (
    <ProviderButton
      key="google"
      label="Continue with Google"
      icon={<GoogleIcon color={colors.ink} size={18} />}
      loading={busy === 'google'}
      disabled={disabled || (busy !== null && busy !== 'google')}
      onPress={() => run('google')}
      styles={styles}
    />
  );

  return <View style={styles.group}>{[appleBtn, googleBtn]}</View>;
}

function ProviderButton({
  label,
  icon,
  loading,
  disabled,
  onPress,
  styles,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled || loading ? undefined : onPress}
      style={[styles.button, (disabled || loading) && { opacity: 0.6 }]}
    >
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <>
          <View style={styles.icon}>{icon}</View>
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    group: { gap: 12 },
    // Outlined (surface + hairline) rather than a saturated brand fill: reads
    // correctly in light AND dark, and avoids hard-coding Apple-black / Google-white
    // hexes (which the no-raw-hex-outside-theme rule forbids).
    button: {
      height: 54,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    icon: { width: 18, alignItems: 'center' },
    label: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  });
