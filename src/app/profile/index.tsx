import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { BottomNav } from '@/components/BottomNav';
import { colors, fonts, pad } from '@/theme';
import { useAuth } from '@/lib/auth';

// Stub. The real Profile screen (per the design spec addendum: identity block,
// counts, sub-tabs, Top 5 dashed slots, Currently watching shelf) comes next.
// For now this exists so authed users have somewhere to land from the bottom
// nav, and so we have a sign-out affordance to test the auth loop.
export default function Profile() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.body}>
        <Text style={styles.title}>Profile</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <Text style={styles.note}>Full profile screen coming next.</Text>

        <View style={{ marginTop: 32 }}>
          <Button label="Sign out" variant="secondary" onPress={signOut} />
        </View>
      </View>
      <BottomNav active="profile" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  body: { flex: 1, padding: pad, paddingTop: 24 },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  email: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted, marginTop: 8 },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.faint, marginTop: 32 },
});
