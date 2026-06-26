// Shared block-filter helper for the read Edge Functions (get-reviews,
// get-comments).
//
// Block is ONE-DIRECTIONAL: blocking hides the blocked user's content from the
// BLOCKER. The `blocks` RLS SELECT policy is `blocker_id = auth.uid()`, so a
// `userClient(req)` reading the table sees ONLY the rows the caller created — i.e.
// exactly "the people I've blocked". Anonymous callers get an empty set.
//
// We fail OPEN (return an empty set) on a read error: a transient blocks-read
// failure should degrade to "show everything" for that one request, not 500 the
// whole reviews/comments list. The filter re-applies on the next load.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export async function blockedUserIds(client: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await client.from('blocks').select('blocked_id');
  if (error) {
    console.error('blockedUserIds: failed to read blocks (failing open):', error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => (r as { blocked_id: string }).blocked_id));
}
