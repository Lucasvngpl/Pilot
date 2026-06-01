import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFollowList } from '@/api/useFollowList';
import { PersonRow } from '@/components/PersonRow';
import { ChevronLeftIcon } from '@/components/icons';
import { type, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

type Kind = 'following' | 'followers';

// Following / Followers list screen — back + title header, then tappable
// PersonRows. Shared by /user/[id]/following and /user/[id]/followers.
export function FollowList({ userId, kind }: { userId: string; kind: Kind }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { data, isLoading, isError } = useFollowList(userId, kind);
  const title = kind === 'following' ? 'Following' : 'Followers';
  const people = data ?? [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={colors.ink} size={24} />
        </Pressable>
        <Text style={[type.subhead, { color: colors.ink }]}>{title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ padding: pad }} color={colors.ink} />
      ) : isError ? (
        <Text style={styles.muted}>Couldn&apos;t load {title.toLowerCase()}.</Text>
      ) : people.length === 0 ? (
        <Text style={styles.muted}>
          {kind === 'following' ? 'Not following anyone yet.' : 'No followers yet.'}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {people.map((p) => (
            <PersonRow key={p.id} person={p} />
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
