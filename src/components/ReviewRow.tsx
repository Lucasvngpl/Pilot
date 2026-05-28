import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, type, pad } from '@/theme';
import { StarIcon, DotsIcon, HeartIcon, CommentIcon } from '@/components/icons';
import { Poster } from '@/components/Poster';

type Props = {
  username: string;
  avatarUri?: string;
  showTitle: string;
  seasonLine?: string;
  rating: number; // 0..5 (half-stars are rounded for the star count here)
  body: string;
  likes: number;
  tmdbShowId: number;
  posterPath?: string | null;
};

export function ReviewRow(p: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        {p.avatarUri ? (
          <Image source={{ uri: p.avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: colors.hairline }]} />
        )}
        <Text style={[type.reviewUser, { color: colors.ink, flex: 1, marginLeft: 8 }]}>
          {p.username}
        </Text>
        <DotsIcon color={colors.faint} size={16} />
      </View>

      <View style={styles.body}>
        <View style={styles.text}>
          <Text style={[type.reviewTitle, { color: colors.ink }]}>{p.showTitle}</Text>
          {p.seasonLine && (
            <Text style={[type.reviewSeason, { color: colors.muted, marginTop: 2 }]}>
              {p.seasonLine}
            </Text>
          )}
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
              <StarIcon
                key={s}
                color={s <= Math.round(p.rating) ? colors.gold : colors.hairline}
                size={12}
              />
            ))}
          </View>
          <Text style={[type.reviewBody, { color: colors.ink, marginTop: 8 }]}>{p.body}</Text>
        </View>
        <Poster
          tmdbShowId={p.tmdbShowId}
          posterPath={p.posterPath}
          name={p.showTitle}
          width={46}
          pressable={false}
        />
      </View>

      <View style={styles.meta}>
        <HeartIcon color={colors.muted} size={14} />
        <Text style={[type.reviewMeta, { color: colors.muted, marginLeft: 5 }]}>
          {p.likes} likes
        </Text>
        <View style={{ width: 16 }} />
        <CommentIcon color={colors.muted} size={14} />
        <Text style={[type.reviewMeta, { color: colors.muted, marginLeft: 5 }]}>Comment</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 16,
    paddingHorizontal: pad,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  body: { flexDirection: 'row', gap: 12 },
  text: { flex: 1 },
  stars: { flexDirection: 'row', gap: 1, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
});
