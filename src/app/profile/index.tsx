import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/Button';
import { ProfileView } from '@/components/ProfileView';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// Own profile = ProfileView in 'own' mode. The only thing this route adds is the
// anonymous fallback (BottomNav normally routes anon users to /welcome, but guard
// for a deep link / sign-out-while-here).
export default function Profile() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { user } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.signedOut}>
          <Text style={[type.compactH, { color: colors.ink }]}>Profile</Text>
          <Text style={[type.reviewBody, styles.signedOutText]}>
            Log in to see your profile, watchlist, and the shows you&apos;ve tracked.
          </Text>
          <View style={styles.signedOutBtn}>
            <Button label="Log in" onPress={() => router.push('/welcome' as any)} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return <ProfileView userId={user.id} variant="own" />;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  signedOut: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: pad },
  signedOutText: { color: colors.muted, marginTop: 8, textAlign: 'center' },
  signedOutBtn: { marginTop: 20, alignSelf: 'stretch' },
});
