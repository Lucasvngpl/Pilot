// ReportSheet — pick a reason, file a report. The overlay half of the 1.2
// "Report" affordance (PIL-24), reused for any reportable target (review / list /
// comment / profile). Renders as Pilot's Sheet overlay (not a Modal) so it can
// stack over the ⋯ action menu and the LoginSheet the auth gate may raise.
import { Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { useReport } from '@/api/useReport';
import { REPORT_REASONS, type ReportReason, type ReportTargetType } from '@/types';
import { fonts, pad, type, type Palette } from '@/theme';
import { useThemedStyles, useTheme } from '@/lib/theme';

export type ReportTarget = { type: ReportTargetType; id: string };

type Props = { visible: boolean; onClose: () => void; target: ReportTarget };

// Human label for the sheet title — what you're reporting.
const NOUN: Record<ReportTargetType, string> = {
  review: 'review',
  list: 'list',
  comment: 'comment',
  profile: 'user',
};

export function ReportSheet({ visible, onClose, target }: Props) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const { report } = useReport();

  const onPick = async (reason: ReportReason) => {
    // Close the sheet FIRST so the result alert appears cleanly over the dismissed
    // sheet (same close-then-act pattern as ActionMenuSheet).
    onClose();
    const result = await report(target.type, target.id, reason);
    if (result === 'ok') {
      Alert.alert('Reported', "Thanks — our team will review this within 24 hours.");
    } else if (result === 'already') {
      Alert.alert('Already reported', "You've already reported this. We're on it.");
    } else if (result === 'error') {
      Alert.alert("Couldn't report", 'Please try again.');
    }
    // 'dismissed' (login cancelled / duplicate tap) → no alert.
  };

  // Title row + a reason per row, sized to content (reasons + title + grabber).
  const height = REPORT_REASONS.length * 56 + 110;

  return (
    <Sheet visible={visible} onClose={onClose} height={height}>
      <Text style={styles.title}>Report this {NOUN[target.type]}</Text>
      <Text style={styles.subtitle}>Why are you reporting it?</Text>
      {REPORT_REASONS.map((reason, i) => (
        <Pressable
          key={reason}
          style={[styles.row, i > 0 && styles.divider]}
          onPress={() => onPick(reason)}
        >
          <Text style={[styles.reason, { color: colors.ink }]}>{reason}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink, paddingHorizontal: pad },
  subtitle: {
    fontFamily: type.reviewBody.fontFamily,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: pad,
    marginTop: 2,
    marginBottom: 6,
  },
  row: { paddingVertical: 16, paddingHorizontal: pad },
  divider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  reason: { fontFamily: fonts.medium, fontSize: 16 },
});
