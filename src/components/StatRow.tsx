import { View, Text, StyleSheet } from 'react-native';
import { colors, type } from '@/theme';
import { StarIcon, TrendUpIcon } from '@/components/icons';
import { AvatarCluster } from '@/components/AvatarCluster';

type Props = {
  rating?: number | null;
  viewers?: number;
  popularity?: number;
};

// Letterboxd-style social compact: rating · viewers · popularity.
// 34px gap between cells per spec.
export function StatRow({ rating, viewers, popularity }: Props) {
  return (
    <View style={styles.row}>
      <Stat
        value={rating != null ? rating.toFixed(1) : '—'}
        label="AVG RATING"
        icon={<StarIcon color={colors.gold} size={16} />}
      />
      <Stat
        value={viewers ? formatK(viewers) : '—'}
        label="VIEWERS"
        icon={<AvatarCluster count={4} />}
      />
      <Stat
        value={popularity != null ? String(popularity) : '—'}
        label="POPULARITY"
        icon={<TrendUpIcon color={colors.red} size={14} />}
      />
    </View>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <View style={styles.cell}>
      <View style={styles.top}>
        {icon}
        <Text style={[type.statValue, { color: colors.ink, marginLeft: 6 }]}>{value}</Text>
      </View>
      <Text style={[type.statLabel, { color: colors.faint, marginTop: 4, letterSpacing: 0.5 }]}>
        {label}
      </Text>
    </View>
  );
}

function formatK(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 34 },
  cell: { alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center' },
});
