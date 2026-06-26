/**
 * get-reviews — Edge Function
 *
 * GET  /functions/v1/get-reviews?tmdb_show_id=123
 * POST /functions/v1/get-reviews   body: { "tmdb_show_id": 123 }
 *
 * Returns all reviews for a show, enriched with reviewer profile, like count,
 * and the reviewer's rating for the same scope:
 *
 *   { reviews: [{ id, user_id, season_number, episode_number, body,
 *                 contains_spoilers, created_at, username, avatar_url,
 *                 likes, rating }] }
 *
 * Public read — reviews RLS is `select using (true)`, so anonymous works.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { userClient } from '../_shared/clients.ts';
import { blockedUserIds } from '../_shared/blocks.ts';

type EmbeddedReview = {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null } | null;
  review_likes: { count: number }[];
};

type RatingSlim = {
  user_id: string;
  season_number: number | null;
  episode_number: number | null;
  score: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const tmdb_show_id = await parseShowId(req);
    if (!tmdb_show_id) {
      return json({ error: 'tmdb_show_id (positive int) required' }, 400);
    }

    const client = userClient(req);

    // Reviews + reviewer profile + like count — PostgREST embeds via the FKs
    // reviews.user_id→profiles.id and review_likes.review_id→reviews.id.
    //
    // `profiles!reviews_user_id_fkey` is REQUIRED, not cosmetic: there are two
    // FK paths from reviews to profiles — the author (reviews.user_id) and the
    // likers (reviews→review_likes.user_id). Without naming the FK, PostgREST
    // can't tell which `profiles` we mean and throws PGRST201 ("more than one
    // relationship"). Naming the constraint pins it to the author.
    const { data, error } = await client
      .from('reviews')
      .select('*, profiles!reviews_user_id_fkey(username, display_name, avatar_url), review_likes(count)')
      .eq('tmdb_show_id', tmdb_show_id)
      .eq('is_draft', false) // public Reviews tab never shows unpublished drafts
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Hide reviews authored by anyone the CALLER has blocked (one-directional;
    // anonymous → empty set → no-op). Applied server-side so a blocked user's
    // review never leaves the server — defense in depth for the 1.2 block.
    const blocked = await blockedUserIds(client);
    const reviews = ((data ?? []) as EmbeddedReview[]).filter((r) => !blocked.has(r.user_id));

    // Rating merge happens IN JS, never via a SQL join.
    // `ratings` has no FK to `reviews`, and a join on
    // (user_id, season_number, episode_number) would use SQL NULL≠NULL — that
    // silently drops rating attribution for whole-show reviews (season +
    // episode both null). JS `=== null` matches nulls correctly.
    const userIds = [...new Set(reviews.map((r) => r.user_id))];
    let ratings: RatingSlim[] = [];
    if (userIds.length > 0) {
      const { data: rData, error: rErr } = await client
        .from('ratings')
        .select('user_id, season_number, episode_number, score')
        .eq('tmdb_show_id', tmdb_show_id)
        .in('user_id', userIds);
      if (rErr) throw rErr;
      ratings = (rData ?? []) as RatingSlim[];
    }

    const ratingFor = (r: EmbeddedReview): number | null => {
      const hit = ratings.find(
        (rt) =>
          rt.user_id === r.user_id &&
          rt.season_number === r.season_number &&
          rt.episode_number === r.episode_number,
      );
      return hit ? hit.score : null;
    };

    const result = reviews.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      season_number: r.season_number,
      episode_number: r.episode_number,
      body: r.body,
      contains_spoilers: r.contains_spoilers,
      created_at: r.created_at,
      username: r.profiles?.username ?? 'unknown',
      display_name: r.profiles?.display_name ?? null,
      avatar_url: r.profiles?.avatar_url ?? null,
      likes: r.review_likes?.[0]?.count ?? 0,
      rating: ratingFor(r),
    }));

    return json({ reviews: result });
  } catch (err) {
    // Log the real cause server-side (PostgREST errors are plain objects with a
    // .message), but return a GENERIC string to the client — don't leak schema /
    // constraint / relationship internals to anonymous callers.
    console.error('get-reviews error:', err);
    return json({ error: 'Something went wrong loading reviews.' }, 500);
  }
});

async function parseShowId(req: Request): Promise<number | null> {
  const url = new URL(req.url);
  const qs = url.searchParams.get('tmdb_show_id');
  if (qs) {
    const n = Number(qs);
    return Number.isInteger(n) && n > 0 ? n : null;
  }
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const n = Number(body.tmdb_show_id);
      return Number.isInteger(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }
  return null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
