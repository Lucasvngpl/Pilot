// ContentActionSheet — the single ⋯ menu for any piece of content (review / list
// / comment / profile), PIL-24. It picks the right actions by ownership:
//   - YOUR content  → the `ownActions` you pass (e.g. Edit / Delete).
//   - someone ELSE's → Report <thing> + Block user (the 1.2 moderation pair).
// Centralizing this here means every surface (review detail, review rows, list
// detail, user profile, comment rows) gets identical, correct moderation UI from
// one component instead of re-implementing the menu + report sheet + block confirm
// five times.
import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuth } from '@/lib/auth';
import { useBlockUser } from '@/api/blocks';
import { ActionMenuSheet, type MenuAction } from '@/components/ActionMenuSheet';
import { ReportSheet } from '@/components/ReportSheet';
import type { ReportTargetType } from '@/types';

// The thing the menu acts on: WHAT it is, its id, and WHOSE it is (to decide
// own-vs-others and which user a Block targets).
export type ModerationTarget = { type: ReportTargetType; id: string; userId: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  target: ModerationTarget;
  // Shown only when the target is the signed-in user's own (e.g. Edit / Delete).
  // Omit for content that has no owner-actions.
  ownActions?: MenuAction[];
  // Fired after a successful block, so a caller can react (e.g. navigate away
  // from the now-hidden user's profile).
  onBlocked?: () => void;
  // When present, a "Copy link" action is prepended to the menu (own AND others').
  // The handler runs synchronously on tap, so it reads a valid target even though
  // the menu closes first — unlike the Report reason-pick, which reads later and
  // needs the reportTarget snapshot above.
  onCopyLink?: () => void;
};

// "review" → "Report review"; profile reports read "Report user".
const REPORT_LABEL: Record<ReportTargetType, string> = {
  review: 'Report review',
  list: 'Report list',
  comment: 'Report comment',
  profile: 'Report user',
};

export function ContentActionSheet({ visible, onClose, target, ownActions, onBlocked, onCopyLink }: Props) {
  const { user } = useAuth();
  const { block } = useBlockUser();
  const [reportOpen, setReportOpen] = useState(false);
  // Snapshot of WHAT we're reporting, captured the instant "Report" is tapped.
  // Why snapshot instead of reading the `target` prop inside <ReportSheet>:
  // ActionMenuSheet closes the menu BEFORE running the action (close-then-act),
  // and most callers derive `target` from the same state their onClose nulls
  // (e.g. `menuReview`). So by the time the user picks a reason, the live
  // `target.id` has collapsed to '' — which hits the `reports.target_id`
  // uuid NOT NULL column and the whole report silently fails. Capturing here,
  // synchronously while `target` is still valid, keeps the real id alive.
  // (Block doesn't need this: confirmBlock reads target.userId synchronously.)
  const [reportTarget, setReportTarget] = useState<{ type: ReportTargetType; id: string } | null>(null);

  const isOwn = !!user && user.id === target.userId;

  const confirmBlock = () => {
    Alert.alert(
      'Block this user?',
      "You won't see their reviews, lists, or comments, and you'll stop following each other.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const ok = await block(target.userId);
            if (ok) onBlocked?.();
          },
        },
      ],
    );
  };

  // Own content shows the caller's edit/delete; others' shows Report + Block.
  // (A blank menu can't happen in practice — callers only open this with either
  // ownActions present or on others' content.)
  // "Copy link" is available on your OWN and others' content alike (prepended).
  const copyAction: MenuAction[] = onCopyLink ? [{ label: 'Copy link', onPress: onCopyLink }] : [];
  const actions: MenuAction[] = isOwn
    ? [...copyAction, ...(ownActions ?? [])]
    : [
        ...copyAction,
        {
          label: REPORT_LABEL[target.type],
          onPress: () => {
            setReportTarget({ type: target.type, id: target.id });
            setReportOpen(true);
          },
        },
        { label: 'Block user', destructive: true, onPress: confirmBlock },
      ];

  return (
    <>
      <ActionMenuSheet visible={visible} onClose={onClose} actions={actions} />
      {/* The report reason picker stacks over the (now-dismissed) menu — they're
          sibling overlays, so render order handles the layering. */}
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        // Use the snapshot taken when Report was tapped. The `??` is just a
        // non-null fallback for the first render, when the sheet is hidden anyway.
        target={reportTarget ?? { type: target.type, id: target.id }}
      />
    </>
  );
}
