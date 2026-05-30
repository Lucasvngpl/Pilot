import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, type, pad } from '@/theme';
import type { PersonResult } from '@/types';

// A person match in People search. NON-TAPPABLE in v1: the other-user profile
// view doesn't exist yet (routing into the own-profile screen would render the
// viewer's own profile). Becomes a link to /user/[id] when Follow + the
// other-user profile land next.
export function PersonRow({ person }: { person: PersonResult }) {
  return (
    <View style={styles.row}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  text: { flex: 1 },
});
