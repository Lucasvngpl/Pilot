import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { ProfileData } from '@/api/useProfile';

export type ProfilePatch = {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
};

/**
 * Update the caller's own `profiles` row (RLS scopes the write to auth.uid()).
 * Optimistic on `['profile', userId]`; on success, broadly invalidates every key
 * that renders profile fields — the avatar + display name also appear in review
 * rows, viewer clusters, and people lists, each cached under its OWN key, so
 * `['profile']` alone would not refresh them.
 */
export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ['profile', userId] as const;

  const mutation = useMutation({
    mutationFn: async (patch: ProfilePatch) => {
      if (!user) throw new Error('useUpdateProfile: no authenticated user');
      const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
      if (error) throw error;
    },

    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<ProfileData>(key);
      if (prev?.profile) {
        qc.setQueryData<ProfileData>(key, { ...prev, profile: { ...prev.profile, ...patch } });
      }
      return { prev };
    },

    onError: (err, _patch, ctx) => {
      console.error('[useUpdateProfile] write failed:', err);
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },

    onSettled: () => {
      // Profile fields live under many keys — refresh them all so the change
      // shows everywhere, not just the edit screen. (Partial-key match.)
      for (const prefix of [
        ['profile'], ['reviews'], ['searchPeople'], ['followList'], ['showViewers'], ['show'],
      ]) {
        qc.invalidateQueries({ queryKey: prefix });
      }
    },
  });

  return { update: mutation.mutateAsync, isPending: mutation.isPending };
}
