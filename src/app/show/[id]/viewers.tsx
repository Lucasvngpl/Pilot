import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useShowViewers } from '@/api/useShowViewers';
import { PersonRow } from '@/components/PersonRow';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

// People who watched or are watching this show — a follow-discovery surface
// (followed-to-top, each row followable). Distinct from the Reviews tab.
export default function Viewers() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, isError } = useShowViewers(Number(id));
  const people = data ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>Viewers</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
      ) : isError ? (
        <Text style={styles.muted}>Couldn&apos;t load viewers.</Text>
      ) : people.length === 0 ? (
        <Text style={styles.muted}>No viewers yet.</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {people.map((p) => (
            <PersonRow key={p.id} person={p} showFollow />
          ))}
        </ScrollView>
      )}
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
  muted: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: type.reviewBody.fontSize,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: pad,
    paddingVertical: 28,
  },
});
