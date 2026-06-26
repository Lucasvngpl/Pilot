// useReport — file a report against a piece of UGC (review / list / comment /
// profile). The client half of the App Store 1.2 "Report" requirement (PIL-24):
// the row lands in the `reports` table, which an admin reads with the service-role
// key and acts on by hand (remove content / eject the user) within 24h. There is
// intentionally NO client read of `reports` — RLS exposes only INSERT (you can
// file one, never read the queue), so who-reported-what stays private.
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { useRequireAuth } from '@/lib/requireAuth';
import type { ReportReason, ReportTargetType } from '@/types';

// Outcome of a report attempt, so the UI can show the right toast/alert.
export type ReportResult = 'ok' | 'already' | 'dismissed' | 'error';

// Dedupe rapid taps per target (the unique(reporter, target) constraint would
// 23505 a fast double-fire anyway; this avoids the flash).
const inFlight = new Set<string>();

export function useReport() {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();

  const mutation = useMutation({
    mutationFn: async (vars: { targetType: ReportTargetType; targetId: string; reason: ReportReason }) => {
      // Session can drop between the gate and the write — fail loud.
      if (!user) throw new Error('useReport: no authenticated user');
      const { error } = await supabase.from('reports').insert({
        reporter_id: user.id,
        target_type: vars.targetType,
        target_id: vars.targetId,
        reason: vars.reason,
      });
      if (error) throw error;
    },
  });

  const report = async (
    targetType: ReportTargetType,
    targetId: string,
    reason: ReportReason,
  ): Promise<ReportResult> => {
    const key = `${targetType}:${targetId}`;
    if (inFlight.has(key)) return 'dismissed';
    inFlight.add(key);
    try {
      // Reporting is a write → gate behind login (browse-free, act-gated).
      const allowed = await requireAuth();
      if (!allowed) return 'dismissed';
      await mutation.mutateAsync({ targetType, targetId, reason });
      return 'ok';
    } catch (e) {
      // unique(reporter_id, target_type, target_id) → a second report is a 23505;
      // treat it as "already reported", not an error.
      if ((e as { code?: string })?.code === '23505') return 'already';
      console.error('[useReport] failed:', e);
      return 'error';
    } finally {
      inFlight.delete(key);
    }
  };

  return { report, isPending: mutation.isPending };
}
