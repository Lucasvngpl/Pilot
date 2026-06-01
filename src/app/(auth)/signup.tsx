import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { fonts, pad24, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { ChevronLeftIcon } from '@/components/icons';
import { useAuth } from '@/lib/auth';

// Sign Up isn't a sheet in the spec — full screen with a back chevron.
// Same form vocabulary as the Login Sheet so the visual treatment is
// cohesive.
export default function SignUp() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  // Naive validation — Supabase enforces real format + min length server-side
  // but blocking the button until the form's plausibly filled feels nicer.
  const canSubmit = email.includes('@') && password.length >= 8;

  const onSignUp = async () => {
    setLoading(true);
    setError(null);
    const result = await signUp(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      // Email-confirmation flow: no session arrives yet — show a holding state.
      // (Disable "Confirm email" in Supabase Dashboard → Auth → Email to skip.)
      setConfirmSent(true);
    }
    // If a session DID arrive, AuthGate handles the redirect to /.
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.nav}>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {confirmSent ? (
            <ConfirmSent email={email} />
          ) : (
            <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                One email, one password. You can edit your profile later.
              </Text>

              <View style={styles.fields}>
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
                  placeholder="At least 8 characters"
                  secureTextEntry
                />
                {error && <Text style={styles.error}>{error}</Text>}
              </View>

              <Button
                label="Create account"
                onPress={onSignUp}
                disabled={!canSubmit}
                loading={loading}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConfirmSent({ email }: { email: string }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>
        We sent a confirmation link to <Text style={{ color: colors.ink, fontFamily: fonts.semibold }}>{email}</Text>. Open it on this device, then come back here to sign in.
      </Text>
      <View style={{ height: 32 }} />
      <Button label="Back to log in" variant="secondary" onPress={() => router.replace('/welcome' as any)} />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: { paddingHorizontal: pad24, paddingVertical: 8 },
  body: {
    paddingHorizontal: pad24,
    paddingTop: 24,
    paddingBottom: 24,
    flexGrow: 1,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 21,
  },
  fields: { marginTop: 32, marginBottom: 24 },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.red,
    marginTop: 8,
    textAlign: 'center',
  },
});
