import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Skeleton } from '@/components/Skeleton';
import { pad, radius } from '@/theme';

// Screen-shaped skeletons composed from the <Skeleton> primitive. Each mirrors
// the real layout it stands in for, so a screen holds its shape while loading
// instead of flashing a spinner on blank. Dimensions track the real components
// (PosterGrid COLS=4, ShowResultRow 48px thumb, Home shelf 118px posters).

const GAP = 10;

// Horizontal poster shelf — Home shelves, Profile "currently watching".
export function PosterRowSkeleton({ count = 4, width = 118 }: { count?: number; width?: number }) {
  return (
    <View style={styles.shelf}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={width} height={Math.round(width * 1.5)} radius={radius.md} />
      ))}
    </View>
  );
}

// Home: two labelled shelves (Popular on TV, New From Friends).
export function HomeSkeleton() {
  return (
    <View style={{ paddingTop: 8 }}>
      {[0, 1].map((s) => (
        <View key={s} style={styles.section}>
          <Skeleton width={170} height={22} style={{ marginHorizontal: pad }} />
          <PosterRowSkeleton />
        </View>
      ))}
    </View>
  );
}

// Vertical show rows — Search trending + results. Mirrors ShowResultRow:
// a 48-wide poster thumb plus title/year lines.
export function ShowRowsSkeleton({ count = 7 }: { count?: number }) {
  return (
    <View style={styles.listPad}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={48} height={72} radius={radius.sm} />
          <View style={styles.rowText}>
            <Skeleton width="55%" height={15} />
            <Skeleton width={40} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Vertical person rows — People search. Circle avatar + name lines.
export function PersonRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.listPad}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={44} height={44} radius={22} />
          <View style={styles.rowText}>
            <Skeleton width="45%" height={14} />
            <Skeleton width="30%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Vertical review rows — the "my reviews" surface. Mirrors ReviewRow: a header
// (avatar + name), body (text lines + a small poster), and a meta line.
export function ReviewRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.reviewRow}>
          <View style={styles.reviewHead}>
            <Skeleton width={28} height={28} radius={14} />
            <Skeleton width={120} height={13} />
          </View>
          <View style={styles.reviewBody}>
            <View style={styles.reviewText}>
              <Skeleton width="70%" height={15} />
              <Skeleton width={70} height={12} />
              <Skeleton width="95%" height={12} />
              <Skeleton width="85%" height={12} />
            </View>
            <Skeleton width={46} height={69} radius={radius.sm} />
          </View>
        </View>
      ))}
    </View>
  );
}

// 4-column poster grid — List detail, Profile Shows/Watchlist tabs.
export function PosterGridSkeleton({ count = 8 }: { count?: number }) {
  const { width: screenW } = useWindowDimensions();
  const tileW = Math.floor((screenW - pad * 2 - GAP * 3) / 4); // 4 cols, 3 gaps
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} width={tileW} height={Math.round(tileW * 1.5)} radius={radius.md} />
      ))}
    </View>
  );
}

// Full Profile body — identity, tabs, Top-4 row, a "currently watching" shelf.
export function ProfileSkeleton() {
  const { width: screenW } = useWindowDimensions();
  const slotW = Math.floor((screenW - pad * 2 - GAP * 3) / 4); // same 4-up as Top-4
  return (
    <View>
      <View style={styles.identityRow}>
        <View style={styles.identityText}>
          <Skeleton width={160} height={26} />
          <Skeleton width={90} height={13} />
          <Skeleton width={150} height={14} style={{ marginTop: 4 }} />
        </View>
        <Skeleton width={72} height={72} radius={36} />
      </View>
      <Skeleton width={220} height={20} style={styles.gutter} />
      <Skeleton width={120} height={20} style={[styles.gutter, { marginTop: 24 }]} />
      <View style={styles.top4Row}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width={slotW} height={Math.round(slotW * 1.5)} radius={radius.md} />
        ))}
      </View>
      <Skeleton width={180} height={20} style={[styles.gutter, { marginTop: 24 }]} />
      <PosterRowSkeleton count={4} width={112} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8, marginBottom: 16 },
  shelf: { flexDirection: 'row', gap: 12, paddingHorizontal: pad, paddingTop: 12 },
  listPad: { paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 8 },
  rowText: { flex: 1, gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: pad, paddingTop: 12 },
  identityRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: pad, paddingBottom: 16 },
  identityText: { flex: 1, gap: 10 },
  top4Row: { flexDirection: 'row', gap: GAP, paddingHorizontal: pad, marginTop: 12 },
  gutter: { marginHorizontal: pad, marginTop: 8 },
  reviewRow: { paddingHorizontal: pad, paddingVertical: 16, gap: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewBody: { flexDirection: 'row', gap: 12 },
  reviewText: { flex: 1, gap: 8 },
});
