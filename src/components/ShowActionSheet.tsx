import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Sheet } from '@/components/Sheet';
import { StatusPill } from '@/components/StatusPill';
import { RatingPicker } from '@/components/RatingPicker';
import {
  CheckIcon, PlayIcon, ClockIcon,
  PencilSquareIcon, ListPlusIcon,
} from '@/components/icons';
import { useRequireAuth } from '@/lib/requireAuth';
import { useRate } from '@/api/useRate';
import { useSetWatchStatus } from '@/api/useSetWatchStatus';
import { colors, fonts, pad } from '@/theme';
import type { WatchStatus } from '@/types';

type Props = {
  visible: boolean;
  onClose: () => void;
  tmdbShowId: number;
  currentStatus: WatchStatus | null;
  currentRating: number | null;
};

// Bottom sheet for per-show actions. Anonymous users see the sheet; the gate
// is per-action via useRequireAuth.
export function ShowActionSheet({
  visible, onClose, tmdbShowId, currentStatus, currentRating,
}: Props) {
  const requireAuth = useRequireAuth();
  const { setStatus } = useSetWatchStatus(tmdbShowId);
  const { rate } = useRate(tmdbShowId);

  // "Review or log" → gate, close the sheet, push the composer route.
  const onReviewOrLog = async () => {
    const allowed = await requireAuth();
    if (!allowed) return;
    onClose();
    router.push(`/show/${tmdbShowId}/review`);
  };

  const onComingSoon = async (label: string) => {
    const allowed = await requireAuth();
    if (!allowed) return;
    Alert.alert('Coming soon', `${label} isn't wired up yet.`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} height={560}>
      <View style={styles.pillsRow}>
        <StatusPill Icon={CheckIcon} label="Watched"
          active={currentStatus === 'watched'} onPress={() => setStatus('watched')} />
        <StatusPill Icon={PlayIcon} label="Watching"
          active={currentStatus === 'watching'} onPress={() => setStatus('watching')} />
        <StatusPill Icon={ClockIcon} label="Watchlist"
          active={currentStatus === 'watchlist'} onPress={() => setStatus('watchlist')} />
      </View>

      <View style={styles.hairline} />

      <RatingPicker value={currentRating} onChange={(score) => rate(score)} />

      <View style={styles.hairline} />

      <ActionRow Icon={PencilSquareIcon} label="Review or log..." onPress={onReviewOrLog} />
      <ActionRow Icon={ListPlusIcon} label="Add to lists..." onPress={() => onComingSoon('Add to lists')} />

      <View style={styles.hairline} />

      <Pressable style={styles.close} onPress={onClose}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </Sheet>
  );
}

function ActionRow({
  Icon, label, onPress,
}: {
  Icon: React.ComponentType<{ color?: string; size?: number }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Icon color={colors.ink} size={22} />
      <Text style={styles.rowText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pillsRow: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: pad },
  hairline: { height: 1, backgroundColor: colors.hairline },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: pad, gap: 16,
  },
  rowText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  close: { paddingVertical: 18, alignItems: 'center' },
  closeText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});
