import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ProfileRow } from '@/types';

export type ProfileData = {
  profile: ProfileRow | null;
  followers: number; // people who follow this user (follows.followee_id = id)
  following: number; // people this user follows  (follows.follower_id = id)
};

/**
 * Own-profile identity + follow counts. Reads only public-SELECT social tables
 * directly — no Edge Function, because Profile never touches TMDb (see
 * showCards.ts for the architectural reasoning).
 *
 * Counts use `{ count: 'exact', head: true }` — `head` means "don't send the
 * rows, just the count header", so a user with 10k followers transfers a number,
 * not 10k rows.
 */
export function useProfile(userId: string | undefined) {
  return useQuery<ProfileData>({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId!; // `enabled` guarantees this is set when the fn runs
      const [profileRes, followersRes, followingRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      ]);
      if (profileRes.error) throw profileRes.error;
      return {
        profile: (profileRes.data as ProfileRow | null) ?? null,
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
      };
    },
  });
}
