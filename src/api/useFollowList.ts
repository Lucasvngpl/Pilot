import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PersonResult } from '@/types';

type Kind = 'following' | 'followers';

/**
 * The Following / Followers list for a user.
 *  - following = profiles this user follows  (their followee edges)
 *  - followers = profiles that follow them    (their follower edges)
 *
 * `follows` has TWO FKs to `profiles`, so the embed MUST name the FK or
 * PostgREST 201s (same ambiguity trap as get-reviews). Public-read, so this
 * works for any user, signed in or not.
 */
export function useFollowList(userId: string | undefined, kind: Kind) {
  return useQuery<PersonResult[]>({
    queryKey: ['followList', kind, userId],
    enabled: !!userId,
    queryFn: async () => {
      const id = userId!;
      const select =
        kind === 'following'
          ? 'created_at, profile:profiles!follows_followee_id_fkey(id, username, display_name, avatar_url)'
          : 'created_at, profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)';
      const filterCol = kind === 'following' ? 'follower_id' : 'followee_id';

      const { data, error } = await supabase
        .from('follows')
        .select(select)
        .eq(filterCol, id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // The embed comes back as { profile: {...} }. supabase-js may type it as an
      // object or a single-element array depending on inference — normalize both,
      // and drop any null embed defensively.
      type Row = { profile: PersonResult | PersonResult[] | null };
      return ((data ?? []) as unknown as Row[])
        .map((r) => (Array.isArray(r.profile) ? r.profile[0] : r.profile))
        .filter((p): p is PersonResult => !!p);
    },
  });
}
