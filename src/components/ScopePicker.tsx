import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { fonts, pad, radius, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { TmdbSeason } from '@/types';

export type ScopeKind = 'show' | 'season' | 'episode';
export type ScopeValue = { scopeKind: ScopeKind; season: number; episode: number | null };

// Progressive scope narrowing: Whole show → Season → Episode. Picking Season
// reveals a labeled, selectable row of season chips (S1 / S2 / …); picking
// Episode adds an episode chip row, and keeps a concrete episode selected so the
// resolved scope is NEVER half-formed. Controlled — owns no state, just resolves
// the { season, episode } tuple the social tables + <ScopeActions> consume.
export function ScopePicker({
  seasons,
  value,
  onChange,
}: {
  seasons: TmdbSeason[];
  value: ScopeValue;
  onChange: (next: ScopeValue) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { scopeKind, season, episode } = value;
  const episodesFor = (s: number) => seasons.find((x) => x.season_number === s)?.episodes ?? [];

  // Switching KIND. Episode mode needs a concrete episode → default to the
  // season's first if none chosen yet; show/season clear the episode.
  const pickKind = (k: ScopeKind) =>
    onChange(
      k === 'episode'
        ? { scopeKind: k, season, episode: episode ?? episodesFor(season)[0]?.episode_number ?? 1 }
        : { scopeKind: k, season, episode: null },
    );

  // Switching SEASON. In episode mode, jump to that season's first episode so we
  // never point at an episode the new season doesn't have.
  const pickSeason = (n: number) =>
    onChange(
      scopeKind === 'episode'
        ? { scopeKind, season: n, episode: episodesFor(n)[0]?.episode_number ?? 1 }
        : { scopeKind, season: n, episode: null },
    );

  const LABELS: Record<ScopeKind, string> = { show: 'Whole show', season: 'Season', episode: 'Episode' };

  // One selectable chip — ink-filled when active (inverts in dark, so its label
  // tracks `background`), outlined otherwise. The shared look for season + episode.
  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, { color: active ? colors.background : colors.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.segment}>
        {(['show', 'season', 'episode'] as ScopeKind[]).map((k) => {
          const active = scopeKind === k;
          return (
            <Pressable key={k} onPress={() => pickKind(k)} style={[styles.segItem, active && styles.segItemActive]}>
              <Text style={[styles.segText, { color: active ? colors.background : colors.ink }]}>{LABELS[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      {scopeKind !== 'show' && (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Season</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {seasons.map((s) => (
              <Chip key={s.season_number} label={`S${s.season_number}`} active={s.season_number === season}
                onPress={() => pickSeason(s.season_number)} />
            ))}
          </ScrollView>
        </View>
      )}

      {scopeKind === 'episode' && (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Episode</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {episodesFor(season).map((ep) => (
              <Chip key={ep.episode_number} label={`E${ep.episode_number}`} active={episode === ep.episode_number}
                onPress={() => onChange({ scopeKind, season, episode: ep.episode_number })} />
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // Self-insets by `pad` so a host can drop <ScopePicker/> in full-width.
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.field,
    borderRadius: radius.md,
    padding: 3,
    marginHorizontal: pad,
  },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm },
  segItemActive: { backgroundColor: colors.ink },
  segText: { fontFamily: fonts.semibold, fontSize: 13 },

  block: { marginTop: 14 },
  blockLabel: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.muted,
    paddingHorizontal: pad,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: pad },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
  },
  chipIdle: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.hairline },
  chipActive: { backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 13 },
});
