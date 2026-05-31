import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, pad24 } from '@/theme';
import { Button } from '@/components/Button';
import { TVIllustration } from '@/components/TVIllustration';
import { useRequireAuth } from '@/lib/requireAuth';

// Auth Landing. The "Log in" button uses the same global LoginSheet that
// per-action mutation gates open — one sheet, one code path.
export default function AuthLanding() {
  const requireAuth = useRequireAuth();

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.wordmark}>PILOT</Text>

        <View style={styles.illustrationWell}>
          <TVIllustration size={140} />
        </View>

        {/* "show" is a real View child (not nested Text) so it can carry a
            padded background-fill chip cleanly. */}
        <View style={styles.headline}>
          <Text style={styles.headlineLine}>Track every</Text>
          <View style={styles.line2}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>show</Text>
            </View>
            <Text style={[styles.headlineLine, { marginLeft: 6 }]}>you watch.</Text>
          </View>
        </View>

        <Text style={styles.subhead}>
          Rate, review, and share what you&apos;re watching with friends.
        </Text>

        <View style={styles.buttons}>
          <Button
            label="Sign up free"
            variant="primary"
            onPress={() => router.push('/(auth)/signup')}
          />
          <View style={{ height: 12 }} />
          <Button
            label="Log in"
            variant="secondary"
            onPress={() => { requireAuth(); }}
          />
        </View>

        <Text style={styles.legal}>
          By continuing, you agree to Pilot&apos;s Terms of Use and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  container: { flex: 1, paddingHorizontal: pad24 },

  wordmark: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 3,
    marginTop: 8,
  },

  illustrationWell: {
    alignSelf: 'center',
    marginTop: 32,
    width: 180, height: 180,
    borderRadius: 24,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headline: { marginTop: 40 },
  headlineLine: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  line2: { flexDirection: 'row', alignItems: 'flex-end' },
  chip: {
    backgroundColor: colors.purple,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 4,
  },
  chipText: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.white,
    lineHeight: 38,
  },

  subhead: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
    lineHeight: 21,
    marginTop: 16,
  },

  buttons: { marginTop: 'auto', paddingTop: 24, paddingBottom: 16 },
  legal: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.faint,
    textAlign: 'center',
    lineHeight: 17,
    paddingBottom: 8,
  },
});
