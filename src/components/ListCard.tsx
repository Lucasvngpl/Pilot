import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { colors, type, pad } from '@/theme';
import { tmdbImage } from '@/types';
import type { ListSummary } from '@/types';

// A list row on the Lists tab: a fanned stack of up to 4 poster thumbnails +
// title + show count. Tap → /list/[id].
export function ListCard({ list }: { list: ListSummary }) {
  return (
    <Pressable style={styles.row} onPress={() => router.push(`/list/${list.id}` as any)}>
      <View style={styles.posters}>
        {list.posters.length === 0 ? (
          <View style={styles.thumb} />
        ) : (
          list.posters.slice(0, 4).map((p, i) => {
            const uri = tmdbImage(p, 'w185');
            return uri ? (
              <Image
                key={i}
                source={{ uri }}
                style={[styles.thumb, i > 0 && styles.overlap]}
                contentFit="cover"
              />
            ) : (
              <View key={i} style={[styles.thumb, i > 0 && styles.overlap]} />
            );
          })
        )}
      </View>
      <View style={styles.text}>
        <Text style={[type.reviewTitle, { color: colors.ink }]} numberOfLines={1}>
          {list.title}
        </Text>
        <Text style={[type.filter, { color: colors.muted, marginTop: 2 }]}>
          {list.itemCount} {list.itemCount === 1 ? 'show' : 'shows'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: pad,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  posters: { flexDirection: 'row' },
  thumb: {
    width: 38,
    height: 57,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.white,
  },
  overlap: { marginLeft: -22 }, // fan the posters
  text: { flex: 1 },
});
