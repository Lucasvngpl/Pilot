import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, type, pad } from '@/theme';
import type { PersonResult } from '@/types';

// A person row — used in People search and the Following/Followers lists. Taps
// through to that user's profile. (`as any`: the /user/[id] route exists but the
// typed-route union only regenerates when Metro runs.)
export function PersonRow({
  person,
  onActivate,
}: {
  person: PersonResult;
  onActivate?: () => void; // fired before navigation — used to record a recent search
}) {
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  text: { flex: 1 },
});
