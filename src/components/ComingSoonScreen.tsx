import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// Shared placeholder for profile sub-pages (Diary / Following / Followers) that
// are reachable but not built yet. A real back-affordance + an honest message
// beats a 404 or a dead link.
export function ComingSoonScreen({ title, message }: { title: string; message: string }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.body}>
        <Text style={[type.reviewBody, { color: colors.muted, textAlign: 'center' }]}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: pad,
    paddingVertical: 8,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: pad },
});
