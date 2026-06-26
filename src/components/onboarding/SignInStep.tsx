// Onboarding sign-in GATE — the "force sign in" step. OAuth (Apple/Google) is the
// primary path; email is the smaller fallback so existing test accounts keep working.
// Inline email (not a route push) so the onboarding screen stays MOUNTED — the picks
// from steps 1-2 live in the onboarding context and flush the instant a session lands.
//
// "Force" here means: to SAVE your picks and continue, sign in. It is NOT a hard wall
// — "Maybe later" drops the user into the app as an anonymous browser (browse-free is
// preserved; the per-action gate still handles writes later). On a real sign-in the
// parent wizard advances to the friends step.
import { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { fonts, pad24, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { OAuthButtons } from '@/components/OAuthButtons';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/lib/auth';

type EmailMode = 'signup' | 'login';

export function SignInStep({ onSkip }: { onSkip: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { signIn, signUp } = useAuth();

  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState<EmailMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  // Signup needs a plausibly-valid password (Supabase enforces ≥6 server-side);
  // login just needs something in both fields.
  const canSubmit =
    email.includes('@') && (mode === 'signup' ? password.length >= 8 : password.length > 0);

  const onSubmitEmail = async () => {
    setLoading(true);
    setError(null);
    const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // signUp with email confirmation ON returns no session — the user must click the
    // emailed link, then come back and log in. (Off in this project's settings ⇒ a
    // session arrives immediately and the wizard advances.)
    if (result.needsConfirmation) setConfirmSent(true);
    // On success a session lands via onAuthStateChange; the parent wizard advances.
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Save your picks</Text>
        <Text style={styles.subtitle}>
          Create your account to keep the shows you added and follow friends.
        </Text>

        {confirmSent ? (
          <View style={{ marginTop: 32 }}>
            <Text style={styles.subtitle}>
              We sent a confirmation link to{' '}
              <Text style={{ color: colors.ink, fontFamily: fonts.semibold }}>{email}</Text>. Open
              it on this device, then come back and log in.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 28 }}>
            <OAuthButtons onResult={(r) => { if (r.error) setError(r.error); }} disabled={loading} />

            {!showEmail ? (
              <Pressable style={styles.emailToggle} onPress={() => setShowEmail(true)}>
                <Text style={styles.emailToggleText}>Continue with email</Text>
              </Pressable>
            ) : (
              <View style={styles.emailForm}>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>email</Text>
                  <View style={styles.dividerLine} />
                </View>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  secureTextEntry
                />
                <View style={{ height: 12 }} />
                <Button
                  label={mode === 'signup' ? 'Create account' : 'Log in'}
                  onPress={onSubmitEmail}
                  disabled={!canSubmit}
                  loading={loading}
                />
                <Pressable
                  style={styles.modeToggle}
                  onPress={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(null); }}
                >
                  <Text style={styles.modeToggleText}>
                    {mode === 'signup' ? 'Already have an account? Log in' : 'New to Pilot? Create an account'}
                  </Text>
                </Pressable>
              </View>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        )}

        <Pressable style={styles.skip} onPress={onSkip} hitSlop={8}>
          <Text style={styles.skipText}>Maybe later</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    body: { paddingHorizontal: pad24, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
    title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, letterSpacing: -0.5 },
    subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 21 },
    emailToggle: { alignItems: 'center', paddingVertical: 18, marginTop: 4 },
    emailToggleText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.purple },
    emailForm: { marginTop: 8 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
    dividerText: { fontFamily: fonts.medium, fontSize: 13, color: colors.faint },
    modeToggle: { alignItems: 'center', paddingVertical: 16 },
    modeToggleText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.purple },
    error: { fontFamily: fonts.regular, fontSize: 13, color: colors.red, marginTop: 12, textAlign: 'center' },
    skip: { alignItems: 'center', marginTop: 'auto', paddingTop: 24 },
    skipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted },
  });
