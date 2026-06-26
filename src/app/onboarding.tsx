// /onboarding — first-run flow for brand-new installs. AuthGate routes here ONCE
// (see _layout.tsx), then the "seen" flag (lib/onboarding) keeps returning users out.
//
// Steps:
//   0. Bulk-add shows you've already watched   (local pick → bulk_mark_watched on auth)
//   1. Starter recommendations → watchlist      (local pick → bulk_add_watchlist on auth)
//   2. Sign-in GATE (OAuth primary, email fallback, or "Maybe later" → browse free)
//   3. Find friends (post-auth: invite link + contacts)
//
// "Force sign in" = you can't reach step 3 / save your picks without signing in at
// step 2 — but "Maybe later" still drops you into the app anonymously, so browse-free
// is preserved (the captain's hard constraint).
import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useOnboarding } from '@/lib/onboarding';
import { Button } from '@/components/Button';
import { ChevronLeftIcon } from '@/components/icons';
import { BulkAddStep } from '@/components/onboarding/BulkAddStep';
import { RecommendationsStep } from '@/components/onboarding/RecommendationsStep';
import { SignInStep } from '@/components/onboarding/SignInStep';
import { AddFriendsStep } from '@/components/onboarding/AddFriendsStep';
import { fonts, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

const STEP_COUNT = 4;
const GATE_STEP = 2; // the sign-in gate
const LAST_STEP = 3; // find friends

export default function Onboarding() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { skip, flushing } = useOnboarding();

  const [step, setStep] = useState(0);

  // Post-auth advance: once a session lands on the gate step, wait for the picks to
  // finish flushing, then move on to the friends step. (If the user has no session
  // yet, this does nothing — the gate stays put.)
  useEffect(() => {
    if (step === GATE_STEP && session && !flushing) setStep(LAST_STEP);
  }, [step, session, flushing]);

  const finish = () => router.replace('/' as any);
  const onSkip = () => { skip(); finish(); };

  const canGoBack = step === 1 || (step === GATE_STEP && !session);
  const showTopSkip = step === 0 || step === 1; // skip the whole flow from the pick steps

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* Top bar: optional back · progress dots · optional skip. */}
      <View style={styles.topBar}>
        <View style={styles.topSide}>
          {canGoBack && (
            <Pressable hitSlop={8} onPress={() => setStep((s) => Math.max(0, s - 1))}>
              <ChevronLeftIcon color={colors.ink} size={24} />
            </Pressable>
          )}
        </View>
        <View style={styles.dots}>
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step ? styles.dotActive : i < step ? styles.dotDone : styles.dotIdle,
              ]}
            />
          ))}
        </View>
        <View style={[styles.topSide, { alignItems: 'flex-end' }]}>
          {showTopSkip && (
            <Pressable hitSlop={8} onPress={onSkip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Step body fills the space between the top bar and the footer. */}
      <View style={{ flex: 1 }}>
        {step === 0 && <BulkAddStep />}
        {step === 1 && <RecommendationsStep />}
        {step === GATE_STEP &&
          (session ? (
            <View style={styles.settingUp}>
              <ActivityIndicator color={colors.ink} />
              <Text style={styles.settingUpText}>Setting up your profile…</Text>
            </View>
          ) : (
            <SignInStep onSkip={onSkip} />
          ))}
        {step === LAST_STEP && <AddFriendsStep />}
      </View>

      {/* Footer button — the pick steps advance; the friends step finishes. The gate
          step has no footer (its actions are the auth buttons + "Maybe later"). */}
      {(step === 0 || step === 1) && (
        <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? 0 : 12 }]}>
          <Button label="Continue" onPress={() => setStep((s) => s + 1)} />
        </View>
      )}
      {step === LAST_STEP && (
        <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? 0 : 12 }]}>
          <Button label="Start exploring" onPress={finish} />
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: pad,
      paddingVertical: 12,
    },
    topSide: { width: 60, justifyContent: 'center' },
    dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { height: 6, borderRadius: 3 },
    dotActive: { width: 22, backgroundColor: colors.ink },
    dotDone: { width: 6, backgroundColor: colors.ink },
    dotIdle: { width: 6, backgroundColor: colors.hairline },
    skipText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.muted },
    settingUp: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    settingUpText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
    footer: { paddingHorizontal: pad, paddingTop: 12 },
  });
