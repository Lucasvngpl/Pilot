import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { FollowButton } from '@/components/FollowButton';
import { colors, type, pad } from '@/theme';
import type { PersonResult } from '@/types';

// A person row — People search, Following/Followers, and the show Viewers list.
// Taps through to that user's profile. With `showFollow`, a trailing Follow pill
// makes the list a follow-discovery surface (hidden on your own row).
export function PersonRow({
  person,
  onActivate,
  showFollow,
}: {
  person: PersonResult;
  onActivate?: () => void; // fired before navigation — used to record a recent search
  showFollow?: boolean;
}) {
  const { user } = useAuth();
  return (
    <Pressable
      style={styles.row}
      onPress={() => {
        onActivate?.();
        router.push(`/user/${person.id}` as any);
      }}
    >
      {person.avatar_url ? (
        <Image source={{ uri: person.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
      )}
      <View style={styles.text}>
        <Text style={[type.reviewUser, { color: colors.ink }]} numberOfLines={1}>
          {person.username}
        </Text>
        {person.display_name && (
          <Text style={[type.filter, { color: colors.muted, marginTop: 1 }]} numberOfLines={1}>
            {person.display_name}
          </Text>
        )}
      </View>
      {/* FollowButton is a nested Pressable — it captures its own taps, while the
          rest of the row still navigates to the profile. Hidden on your own row. */}
      {showFollow && user?.id !== person.id && <FollowButton followeeId={person.id} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  text: { flex: 1 },
});
