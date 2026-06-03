import type { ReactNode } from 'react';
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

// Vertical diary rows — the date-grouped watched log (profile/diary.tsx).
// Mirrors DiaryRow: a month band, then rows of [40×40 date cell · 44-wide
// poster · title/scope lines]. One band + N rows keeps the page's shape stable
// while useDiary's multi-table merge resolves, instead of a spinner on blank.
export function DiaryRowsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <View>
      <Skeleton width={110} height={14} radius={radius.sm} style={styles.diaryBand} />
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.diaryRow}>
          <Skeleton width={40} height={40} radius={6} />
          <Skeleton width={44} height={66} radius={radius.sm} />
          <View style={styles.rowText}>
            <Skeleton width="60%" height={15} />
            <Skeleton width="35%" height={12} />
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

// Friends activity feed (activity.tsx). Avatar + a header line + a poster with a
// couple meta lines — mirrors ActivityRow's "watched"/"reviewed" shape.
export function ActivityRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.feedRow}>
          <Skeleton width={32} height={32} radius={16} />
          <View style={styles.feedBody}>
            <Skeleton width="80%" height={14} />
            <View style={styles.feedPosterRow}>
              <Skeleton width={48} height={72} radius={radius.sm} />
              <View style={styles.feedMeta}>
                <Skeleton width={70} height={12} />
                <Skeleton width="90%" height={12} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// Episode list rows (Seasons tab). 104×58 landscape still + scope/title/meta
// lines — mirrors EpisodeRow.
export function EpisodeRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.epRow}>
          <Skeleton width={104} height={58} radius={radius.sm} />
          <View style={styles.rowText}>
            <Skeleton width={56} height={11} />
            <Skeleton width="70%" height={15} />
            <Skeleton width={90} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Actor/person page (person/[id]). Headshot + name, bio lines, then the TV
// appearances grid (reuses PosterGridSkeleton).
export function PersonDetailSkeleton() {
  return (
    <View>
      <View style={styles.personHead}>
        <Skeleton width={92} height={138} radius={radius.md} />
        <Skeleton width="55%" height={22} />
      </View>
      <View style={styles.personBio}>
        <Skeleton width="100%" height={13} />
        <Skeleton width="100%" height={13} />
        <Skeleton width="75%" height={13} />
      </View>
      <Skeleton width={150} height={14} style={[styles.gutter, { marginTop: 24 }]} />
      <PosterGridSkeleton />
    </View>
  );
}

// Episode detail (show/[id]/episode). Full-bleed 16:9 still hero + identity
// lines + an actions block + overview lines. radius={0} → square hero corners.
export function EpisodeDetailSkeleton() {
  const { width } = useWindowDimensions();
  return (
    <View>
      <Skeleton width={width} height={Math.round((width * 9) / 16)} radius={0} />
      <View style={styles.detailHead}>
        <Skeleton width={56} height={11} />
        <Skeleton width="65%" height={22} />
        <Skeleton width={90} height={12} />
      </View>
      <Skeleton height={48} radius={radius.md} style={styles.actionBlock} />
      <View style={styles.detailHead}>
        <Skeleton width="100%" height={13} />
        <Skeleton width="92%" height={13} />
      </View>
    </View>
  );
}

// Log surface (log/[id]). Poster hero + title/year, a scope-picker bar, an
// actions block.
export function LogShowSkeleton() {
  return (
    <View>
      <View style={styles.logHero}>
        <Skeleton width={72} height={108} radius={radius.md} />
        <View style={styles.logHeroText}>
          <Skeleton width="70%" height={20} />
          <Skeleton width={48} height={13} />
        </View>
      </View>
      <Skeleton height={40} radius={radius.md} style={[styles.gutter, { marginTop: 12 }]} />
      <Skeleton height={48} radius={radius.md} style={styles.actionBlock} />
    </View>
  );
}

// List rows (Profile Lists tab, show Lists tab). Fanned poster thumb + title +
// count — mirrors ListCard.
export function ListCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.listCardRow}>
          <Skeleton width={38} height={57} radius={3} />
          <View style={styles.rowText}>
            <Skeleton width="55%" height={15} />
            <Skeleton width={60} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

// List rows in the "Add to list" sheet — two text lines + a check circle.
export function ListRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.checkRow}>
          <View style={styles.rowText}>
            <Skeleton width="50%" height={15} />
            <Skeleton width={50} height={12} />
          </View>
          <Skeleton width={24} height={24} radius={12} />
        </View>
      ))}
    </View>
  );
}

// Search-result rows for the in-form pickers (list/new, top-shows). No outer
// horizontal padding — the host body already pads, so rows line up flush with
// its fields.
export function SearchResultRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.pickerRow}>
          <Skeleton width={40} height={60} radius={radius.sm} />
          <Skeleton width="55%" height={14} />
        </View>
      ))}
    </View>
  );
}

// Wrapper for the show-detail secondary tabs (Seasons / Reviews / Lists) while
// the show payload loads on a cold deep-link. Mirrors ShowCompactHeader + the
// Tabs bar, then renders that tab's own content skeleton as `children`.
export function ShowTabSkeleton({ children }: { children?: ReactNode }) {
  return (
    <View>
      <View style={styles.compactHeader}>
        <Skeleton width={58} height={87} radius={radius.md} />
        <View style={styles.compactText}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="50%" height={12} />
        </View>
      </View>
      <Skeleton height={36} radius={radius.sm} style={styles.tabsBar} />
      {children}
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
  diaryBand: { marginHorizontal: pad, marginTop: 12, marginBottom: 4 },
  diaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 12 },
  reviewRow: { paddingHorizontal: pad, paddingVertical: 16, gap: 12 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewBody: { flexDirection: 'row', gap: 12 },

  // Activity feed rows.
  feedRow: { flexDirection: 'row', gap: 12, paddingHorizontal: pad, paddingVertical: 14 },
  feedBody: { flex: 1, gap: 8 },
  feedPosterRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  feedMeta: { flex: 1, gap: 6, paddingTop: 2 },

  // Episode rows (Seasons tab).
  epRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 10 },

  // Person/episode detail pages.
  personHead: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: pad, paddingVertical: 12 },
  personBio: { paddingHorizontal: pad, gap: 8, marginTop: 4 },
  detailHead: { paddingHorizontal: pad, paddingTop: 14, gap: 8 },
  actionBlock: { marginHorizontal: pad, marginTop: 16 },

  // Log surface.
  logHero: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: pad, paddingVertical: 12 },
  logHeroText: { flex: 1, gap: 10 },

  // List cards + add-to-list rows + in-form picker rows.
  listCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: pad, paddingVertical: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: pad, paddingVertical: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },

  // Show-detail secondary-tab header wrapper.
  compactHeader: { flexDirection: 'row', paddingHorizontal: pad, paddingBottom: 12 },
  compactText: { flex: 1, marginLeft: 12, justifyContent: 'center', gap: 8 },
  tabsBar: { marginHorizontal: pad, marginBottom: 8 },
  reviewText: { flex: 1, gap: 8 },
});
