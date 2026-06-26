/**
 * get-comments — Edge Function
 *
 * GET  /functions/v1/get-comments?target_type=review&target_id=<uuid>
 * POST /functions/v1/get-comments   body: { "target_type": "review", "target_id": "<uuid>" }
 *
 * All comments on one target (a review OR a list), oldest-first (a thread reads
 * top-to-bottom), enriched with the commenter's profile:
 *
 *   { comments: [{ id, user_id, body, created_at,
 *                  username, display_name, avatar_url }] }
 *
 * Public read — comments RLS is `select using (true)`, so anonymous works. Block
 * filtering is applied SERVER-SIDE (defense in depth): a comment authored by a
 * user the CALLER has blocked never leaves the server. Mirrors get-reviews.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { userClient } from '../_shared/clients.ts';
import { blockedUserIds } from '../_shared/blocks.ts';

type TargetType = 'review' | 'list';

type EmbeddedComment = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const target = await parseTarget(req);
    if (!target) {
      return json({ error: 'target_type (review|list) and target_id (uuid) required' }, 400);
    }

    const client = userClient(req);

    // Comments + commenter profile. Only one FK path from comments→profiles
    // (comments.user_id→profiles.id), so a plain `profiles(...)` embed is
    // unambiguous here — no need to name the constraint the way get-reviews must.
    const { data, error } = await client
      .from('comments')
      .select('id, user_id, body, created_at, profiles(username, display_name, avatar_url)')
      .eq('target_type', target.target_type)
      .eq('target_id', target.target_id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const comments = (data ?? []) as unknown as EmbeddedComment[];

    // Drop comments by anyone the caller has blocked (one-directional; anonymous
    // → empty set → no-op).
    const blocked = await blockedUserIds(client);

    const result = comments
      .filter((c) => !blocked.has(c.user_id))
      .map((c) => ({
        id: c.id,
        user_id: c.user_id,
        body: c.body,
        created_at: c.created_at,
        username: c.profiles?.username ?? 'unknown',
        display_name: c.profiles?.display_name ?? null,
        avatar_url: c.profiles?.avatar_url ?? null,
      }));

    return json({ comments: result });
  } catch (err) {
    // Log the real cause, return a generic message (don't leak schema internals).
    console.error('get-comments error:', err);
    return json({ error: 'Something went wrong loading comments.' }, 500);
  }
});

async function parseTarget(
  req: Request,
): Promise<{ target_type: TargetType; target_id: string } | null> {
  let target_type: string | null = null;
  let target_id: string | null = null;

  const url = new URL(req.url);
  target_type = url.searchParams.get('target_type');
  target_id = url.searchParams.get('target_id');

  if ((!target_type || !target_id) && req.method === 'POST') {
    try {
      const body = await req.json();
      target_type = target_type ?? body.target_type ?? null;
      target_id = target_id ?? body.target_id ?? null;
    } catch {
      // fall through to the validation below
    }
  }

  if ((target_type !== 'review' && target_type !== 'list') || !target_id) return null;
  // Cheap UUID shape check — keeps a malformed id from reaching PostgREST.
  if (!/^[0-9a-f-]{36}$/i.test(target_id)) return null;
  return { target_type, target_id };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
