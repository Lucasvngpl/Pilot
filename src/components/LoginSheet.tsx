import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { fonts, pad24, type Palette } from '@/theme';
import { useThemedStyles } from '@/lib/theme';
import { Sheet } from '@/components/Sheet';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/Button';
import { OAuthButtons } from '@/components/OAuthButtons';
import { useAuth } from '@/lib/auth';

type Props = { visible: boolean; onClose: () => void };

// Globally-mounted login sheet. Both the auth landing's "Log in" button and
// per-action mutation gates open this single instance via useRequireAuth().
export function LoginSheet({ visible, onClose }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal keeps its children mounted across visibility changes — wipe fields
  // when it closes so reopening gives a fresh form.
  useEffect(() => {
    if (!visible) {
      setEmail('');
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  const canSubmit = email.length > 0 && password.length > 0;

  const onLogin = async () => {
    setLoading(true);
    setError(null);
    const result = await signIn(email, password);
    setLoading(false);
    if (result.error) setError(result.error);
    else onClose(); // session arrives via onAuthStateChange, sheet dismisses
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={600}>
      <Text style={styles.sheetTitle}>Log in to Pilot</Text>

      <View style={styles.sheetBody}>
        {/* OAuth-primary: Apple / Google sit ABOVE the email form. On success the
            session arrives via onAuthStateChange and RequireAuthProvider dismisses
            this sheet, so we only need to surface errors here. */}
        <OAuthButtons onResult={(r) => { if (r.error) setError(r.error); }} disabled={loading} />

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email address"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          rightAccessory={
            <Pressable hitSlop={8}>
              <Text style={styles.forgot}>Forgot password?</Text>
            </Pressable>
          }
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={{ marginTop: 8 }}>
          <Button label="Log in" onPress={onLogin} disabled={!canSubmit} loading={loading} />
        </View>
      </View>
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: 24,
  },
  sheetBody: { paddingHorizontal: pad24 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.hairline },
  dividerText: { fontFamily: fonts.medium, fontSize: 13, color: colors.faint },
  forgot: { fontFamily: fonts.semibold, fontSize: 13, color: colors.purple },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.red,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
});
