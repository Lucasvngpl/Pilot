import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { StatusPill } from '@/components/StatusPill';
import { RatingPicker } from '@/components/RatingPicker';
import { CheckIcon, PlayIcon, ClockIcon, PencilSquareIcon, ListPlusIcon, EpisodesIcon, ChevronRightIcon } from '@/components/icons';
import { useRequireAuth } from '@/lib/requireAuth';
import { useRate } from '@/api/useRate';
import { useSetWatchStatus } from '@/api/useSetWatchStatus';
import { useToggleEpisodeWatched } from '@/api/useToggleEpisodeWatched';
import { fonts, pad, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';
import type { WatchStatus } from '@/types';

// The scope tuple every entry point resolves to. season=episode=null → whole
// show; season set → season; both set → one episode. (Same shape as the social
// tables — see CLAUDE.md "Polymorphic scope".)
export type Scope = {
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
};

// THE single source of truth for which statuses make sense at a scope — prune the
// nonsensical combos so the row only ever shows meaningful options (omit, never
// disable). Rate / Review / Add-to-list stay available at every scope regardless.
//  - whole show : Watched · Watching · Watchlist
//  - season     : Watched · Watching            (a per-season watchlist is noise;
//                                                 show-level watchlist covers it)
//  - episode    : Watched                        (an episode is binary watched/not)
export function statusesForScope(scope: Scope): WatchStatus[] {
  if (scope.episode_number != null) return ['watched'];
  if (scope.season_number != null) return ['watched', 'watching'];
  return ['watched', 'watching', 'watchlist'];
}

// Icon + label per status (the order above drives render order).
const STATUS_META: Record<WatchStatus, { Icon: React.ComponentType<{ color?: string; size?: number }>; label: string }> = {
  watched: { Icon: CheckIcon, label: 'Watched' },
  watching: { Icon: PlayIcon, label: 'Watching' },
  watchlist: { Icon: ClockIcon, label: 'Watchlist' },
};

type Props = {
  scope: Scope;
  // Status + rating AT THIS scope, supplied by the host (it knows the scope's
  // current social rows). Drives the active pill + the picker's filled value.
  currentStatus: WatchStatus | null;
  currentRating: number | null;
  // Close the host container (sheet / menu) before a navigation so the composer
  // opens cleanly over a dismissed surface.
  onRequestClose: () => void;
  // The host opens its OWN AddToListSheet (a full-screen overlay that must be a
  // SIBLING of the host sheet, not nested inside it — see "Sheets are overlays"
  // in CLAUDE.md). ScopeActions owns the gate + the row; the host owns the mount.
  onAddToList: () => void;
};

/**
 * THE single source of truth for "what can you do to a scope": Rate · Review ·
 * Add to list · Mark watched. Every entry point (show action sheet today; the
 * "+" picker and in-show / long-press menus next) feeds a tuple and renders THIS
 * — no screen re-implements an action, so they can't drift.
 *
 * Each action is wired to the EXISTING, now scope-aware mutation: useRate and
 * useSetWatchStatus both take the scope tuple. The host owns the chrome (sheet,
 * Close); this renders only the action set.
 */
export function ScopeActions({
  scope, currentStatus, currentRating, onRequestClose, onAddToList,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const { tmdb_show_id, season_number, episode_number } = scope;
  const requireAuth = useRequireAuth();
  const { setStatus, clearStatus } = useSetWatchStatus(tmdb_show_id);
  const { rate } = useRate(tmdb_show_id);
  const { toggle: toggleEpisode } = useToggleEpisodeWatched(tmdb_show_id);

  // The scope passed through to every mutation (the show id is the hook arg).
  const scopeArg = { season_number, episode_number };
  const isEpisode = episode_number != null; // episodes are binary watched/not
  const isSeason = season_number != null && episode_number == null;

  // "Review or log" → gate, close the host, open the composer for this scope.
  // The season/episode params preset + lock the composer's scope (it reads them
  // as of the in-show entry-point work); omitted → the composer's show default.
  const onReviewOrLog = async () => {
    const allowed = await requireAuth();
    if (!allowed) return;
    onRequestClose();
    const q =
      season_number == null
        ? ''
        : `?season=${season_number}` + (episode_number != null ? `&episode=${episode_number}` : '');
    router.push(`/show/${tmdb_show_id}/review${q}` as any);
  };

  const onAddToListPress = async () => {
    const allowed = await requireAuth();
    if (!allowed) return;
    onAddToList(); // host opens its sibling AddToListSheet with this scope
  };

  // "View all episodes" — pure navigation to the season's episode list. No auth
  // gate: browsing the catalog is always free (CLAUDE.md "browse free, gate per
  // action"). Surfaces the episode drill-down from the sheet, not just by tapping
  // the season row — the discoverability ask this row exists for.
  const onViewAllEpisodes = () => {
    onRequestClose();
    router.push(`/show/${tmdb_show_id}/season?season=${season_number}` as any);
  };

  return (
    <>
      {/* Status pills — only the statuses valid for this scope (statusesForScope).
          Every pill is a TOGGLE: tapping the ACTIVE one un-marks it (clears the
          row), tapping an inactive one sets/switches to it. Episode-`watched`
          routes to its own binary hook (delete-on-unwatch); show/season scope
          set via setStatus / clear via clearStatus (the delete path). season_number
          is non-null at episode scope (DB CHECK), so the toggle args are safe. */}
      <View style={styles.pillsRow}>
        {statusesForScope(scope).map((status) => {
          const { Icon, label } = STATUS_META[status];
          const isActive = currentStatus === status;
          const onPress =
            isEpisode && status === 'watched'
              ? () => toggleEpisode({
                  tmdb_show_id,
                  season_number: season_number!,
                  episode_number,
                  currentlyWatched: currentStatus === 'watched',
                })
              : isActive
              ? () => clearStatus(scopeArg)   // un-tap the active status → remove it
              : () => setStatus(status, scopeArg);
          return (
            <StatusPill key={status} Icon={Icon} label={label}
              active={isActive} onPress={onPress} />
          );
        })}
      </View>

      <RatingPicker value={currentRating} onChange={(score) => rate(score, scopeArg)} />

      {/* Action rows, each split off by a hairline so they read as distinct buttons
          (PIL-16). The leading divider separates the button list from the rating
          picker above it; the rest sit between consecutive rows. */}
      <View style={styles.divider} />
      {/* Season-only: drill into the episode list. First action + trailing chevron
          so "you can see the episodes" is unmistakable (vs the row's own tap). */}
      {isSeason && (
        <>
          <ActionRow Icon={EpisodesIcon} label="View all episodes" onPress={onViewAllEpisodes} chevron />
          <View style={styles.divider} />
        </>
      )}
      <ActionRow Icon={PencilSquareIcon} label="Review or log" onPress={onReviewOrLog} />
      <View style={styles.divider} />
      <ActionRow Icon={ListPlusIcon} label="Add to lists" onPress={onAddToListPress} />
    </>
  );
}

function ActionRow({
  Icon, label, onPress, chevron = false,
}: {
  Icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  onPress: () => void;
  // Trailing chevron marks a row that NAVIGATES away, vs the in-place mutation
  // rows (matches the Profile nav-row convention). Default off.
  chevron?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Icon color={colors.ink} size={22} />
      <Text style={styles.rowText}>{label}</Text>
      {chevron && <ChevronRightIcon color={colors.muted} size={20} />}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  // Center the pills as a group with a fixed gap (pills are content-sized, not
  // flex) — looks balanced for 1, 2, or 3 statuses instead of spreading them to
  // the row edges. gap 44 keeps 2 pills comfortably near center, 3 still readable.
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 44,
    paddingVertical: 16,
    paddingHorizontal: pad,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: pad, gap: 16,
  },
  // Full-width hairline between action rows (PIL-16). A View divider (not a row
  // border) because the rows are rendered inline, not mapped.
  divider: { height: 1, backgroundColor: colors.hairline },
  // flex:1 lets the label fill the row so a trailing chevron lands at the far
  // right; visually identical for rows without one (text stays left-aligned).
  rowText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});
