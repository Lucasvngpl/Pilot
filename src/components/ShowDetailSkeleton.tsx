import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { radius, pad } from '@/theme';

// Skeleton for the Show Detail screen. Mirrors the real layout below the nav
// row — centered poster, title/creator/meta stack, the 3-up stat row, the
// rating card, tabs, and two review rows — so the page holds its shape while
// the show loads instead of flashing a spinner on blank. Keep these dimensions
// roughly in step with app/show/[id]/index.tsx.
export function ShowDetailSkeleton() {
  return (
    <View style={styles.root}>
      {/* Hero poster (matches Poster width 152, 2:3 ratio → ~228 tall). */}
      <View style={styles.center}>
        <Skeleton width={152} height={228} radius={radius.md} />
      </View>

      {/* kicker · title · creator · meta — all centered like the real header. */}
      <View style={[styles.center, styles.headerStack]}>
        <Skeleton width={96} height={11} />
        <Skeleton width={220} height={32} />
        <Skeleton width={150} height={16} />
        <Skeleton width={190} height={13} />
      </View>

      {/* 3-up stat row (rating / viewers / popularity). */}
      <View style={styles.statRow}>
        <Skeleton width={64} height={46} />
        <Skeleton width={64} height={46} />
        <Skeleton width={64} height={46} />
      </View>

      {/* "You've rated this show" card — full width minus the page margin. */}
      <Skeleton height={66} radius={radius.md} style={styles.card} />

      {/* Tabs row. */}
      <Skeleton width={210} height={20} style={styles.tabs} />

      {/* Two review rows: avatar + three text lines. */}
      {[0, 1].map((i) => (
        <View key={i} style={styles.reviewRow}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={styles.reviewLines}>
            <Skeleton width="55%" height={13} />
            <Skeleton width="92%" height={12} />
            <Skeleton width="80%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: 16 },
  center: { alignItems: 'center' },
  headerStack: { marginTop: 16, gap: 10 },
  statRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 24 },
  card: { marginHorizontal: pad, marginTop: 16 },
  tabs: { marginHorizontal: pad, marginTop: 24 },
  reviewRow: { flexDirection: 'row', gap: 12, paddingHorizontal: pad, marginTop: 20 },
  reviewLines: { flex: 1, gap: 8, paddingTop: 2 },
});
