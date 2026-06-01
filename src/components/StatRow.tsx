import { View, Text, Pressable, StyleSheet } from 'react-native';
import { type, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import { StarIcon, TrendUpIcon } from '@/components/icons';
import { AvatarCluster } from '@/components/AvatarCluster';

type Props = {
  rating?: number | null;
  viewers?: number;
  viewerAvatars?: (string | null)[]; // faces of viewers the caller follows (else gray)
  onViewersPress?: () => void;
  popularity?: number;
};

// Letterboxd-style social compact: rating · viewers · popularity. 34px gap.
export function StatRow({ rating, viewers, viewerAvatars = [], onViewersPress, popularity }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const viewerCount = viewers ?? 0;
  // Render min(3, viewers) circles; the first ones are followed-viewer faces
  // (from viewerAvatars), the rest fall back to gray placeholders.
  const viewersStat = (
    <Stat
      value={viewerCount ? formatK(viewerCount) : '—'}
      label="VIEWERS"
      icon={<AvatarCluster uris={viewerAvatars} count={Math.min(3, viewerCount)} />}
    />
  );

  return (
    <View style={styles.row}>
      <Stat
        value={rating != null ? rating.toFixed(1) : '—'}
        label="AVG RATING"
        icon={<StarIcon color={colors.gold} size={16} />}
      />
      {onViewersPress ? (
        <Pressable onPress={onViewersPress} hitSlop={6}>
          {viewersStat}
        </Pressable>
      ) : (
        viewersStat
      )}
      <Stat
        value={popularity != null ? String(popularity) : '—'}
        label="POPULARITY"
        icon={<TrendUpIcon color={colors.red} size={14} />}
      />
    </View>
  );
}

function Stat({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 34 },
  cell: { alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center' },
});
