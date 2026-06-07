import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { fetchShowCards } from '@/api/showCards';
import { resolveScope, formatScope, listCountLabel } from '@/types';
import type { MyLikeEntry, LikedReview, ListSummary } from '@/types';

const LIMIT = 100; // newest 100 of each kind — pagination deferred

// Per-(reviewer, scope) rating key for the JS merge (CLAUDE.md: never match
// scoped tables in SQL — NULL ≠ NULL drops whole-show rows).
const ratingKey = (user: string, show: number, s: number | null, e: number | null) =>
  `${user}:${show}:${s}:${e}`;

/**
 * The signed-in user's likes — reviews + lists they've liked, newest-first by WHEN
 * THEY liked it (not when the thing was made). Own-only surface (Profile › My
 * record → Likes). Direct RLS reads — likes are Pilot's own social data.
 *
 * A liked review that's since been unpublished (is_draft) or deleted simply drops
 * out (no published review row to join); a deleted review/list cascades its like
 * away entirely. So this only ever shows still-live, still-public targets.
 */
export function useMyLikes(userId: string | undefined) {
  return useQuery<MyLikeEntry[]>({
    queryKey: ['myLikes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const me = userId!;

      // 1. My like rows (target id + when I liked it), newest-first.
      const [rl, ll] = await Promise.all([
        supabase.from('review_likes').select('review_id, created_at')
          .eq('user_id', me).order('created_at', { ascending: false }).limit(LIMIT),
        supabase.from('list_likes').select('list_id, created_at')
          .eq('user_id', me).order('created_at', { ascending: false }).limit(LIMIT),
      ]);
      if (rl.error) throw rl.error;
      if (ll.error) throw ll.error;
      const reviewLikedAt = new Map(
        (rl.data ?? []).map((r) => [(r as { review_id: string }).review_id, (r as { created_at: string }).created_at]),
      );
      const listLikedAt = new Map(
        (ll.data ?? []).map((r) => [(r as { list_id: string }).list_id, (r as { created_at: string }).created_at]),
      );
      const reviewIds = [...reviewLikedAt.keys()];
      const listIds = [...listLikedAt.keys()];
      if (reviewIds.length === 0 && listIds.length === 0) return [];

      // 2. The liked reviews (PUBLISHED only) + lists.
      const [revRes, listRes] = await Promise.all([
        reviewIds.length
          ? supabase.from('reviews')
              .select('id, user_id, tmdb_show_id, season_number, episode_number, body, contains_spoilers')
              .in('id', reviewIds).eq('is_draft', false)
          : Promise.resolve({ data: [], error: null }),
        listIds.length
          ? supabase.from('lists').select('id, title, description').in('id', listIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (revRes.error) throw revRes.error;
      if (listRes.error) throw listRes.error;
      const reviews = (revRes.data ?? []) as {
        id: string; user_id: string; tmdb_show_id: number;
        season_number: number | null; episode_number: number | null;
        body: string; contains_spoilers: boolean;
      }[];
      const lists = (listRes.data ?? []) as { id: string; title: string; description: string | null }[];

      // 3. List items (for posters + the scope-aware count), ordered for a stable preview.
      const itemsByList = new Map<string, { tmdb_show_id: number; season_number: number | null; episode_number: number | null }[]>();
      if (lists.length) {
        const { data: li, error: liErr } = await supabase
          .from('list_items')
          .select('list_id, tmdb_show_id, season_number, episode_number, position, added_at')
          .in('list_id', lists.map((l) => l.id))
          .order('position', { ascending: true })
          .order('added_at', { ascending: true });
        if (liErr) throw liErr;
        for (const it of (li ?? []) as { list_id: string; tmdb_show_id: number; season_number: number | null; episode_number: number | null }[]) {
          const arr = itemsByList.get(it.list_id) ?? [];
          arr.push(it);
          itemsByList.set(it.list_id, arr);
        }
      }

      // 4. Enrich: reviewer profiles, show cards (review shows + list previews),
      //    reviewers' ratings, and per-review like counts — all in parallel.
      const reviewerIds = [...new Set(reviews.map((r) => r.user_id))];
      const reviewShowIds = reviews.map((r) => r.tmdb_show_id);
      const listPreviewIds = lists.flatMap((l) => (itemsByList.get(l.id) ?? []).slice(0, 4).map((t) => t.tmdb_show_id));
      const allShowIds = [...new Set([...reviewShowIds, ...listPreviewIds])];

      const [profilesRes, cards, ratingRes, likesRes] = await Promise.all([
        reviewerIds.length
          ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', reviewerIds)
          : Promise.resolve({ data: [], error: null }),
        fetchShowCards(allShowIds, { withScopeArt: true }),
        reviewerIds.length
          ? supabase.from('ratings').select('user_id, tmdb_show_id, season_number, episode_number, score')
              .in('user_id', reviewerIds).in('tmdb_show_id', [...new Set(reviewShowIds)])
          : Promise.resolve({ data: [], error: null }),
        reviewIds.length
          ? supabase.from('review_likes').select('review_id').in('review_id', reviewIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (ratingRes.error) throw ratingRes.error;

      const profileById = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();
      for (const p of (profilesRes.data ?? []) as { id: string; username: string; display_name: string | null; avatar_url: string | null }[]) {
        profileById.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
      }
      const ratingByScope = new Map<string, number>();
      for (const r of (ratingRes.data ?? []) as { user_id: string; tmdb_show_id: number; season_number: number | null; episode_number: number | null; score: number }[]) {
        ratingByScope.set(ratingKey(r.user_id, r.tmdb_show_id, r.season_number, r.episode_number), r.score);
      }
      const likesByReview = new Map<string, number>();
      for (const l of (likesRes.data ?? []) as { review_id: string }[]) {
        likesByReview.set(l.review_id, (likesByReview.get(l.review_id) ?? 0) + 1);
      }

      // 5. Build entries (tagged with WHEN I liked it), then merge + sort.
      const reviewEntries: MyLikeEntry[] = reviews.map((r) => {
        const card = cards.get(r.tmdb_show_id);
        const scoped = resolveScope(
          { tmdb_show_id: r.tmdb_show_id, season_number: r.season_number, episode_number: r.episode_number },
          card,
        );
        const prof = profileById.get(r.user_id);
        const review: LikedReview = {
          reviewId: r.id,
          tmdb_show_id: r.tmdb_show_id,
          showName: card?.name ?? 'Untitled',
          posterPath: scoped.posterPath,
          seasonLabel: formatScope(r.season_number, r.episode_number),
          rating: ratingByScope.get(ratingKey(r.user_id, r.tmdb_show_id, r.season_number, r.episode_number)) ?? 0,
          body: r.body,
          containsSpoilers: r.contains_spoilers,
          likes: likesByReview.get(r.id) ?? 0,
          reviewerUsername: prof?.username ?? '',
          reviewerDisplayName: prof?.display_name ?? null,
          reviewerAvatarUrl: prof?.avatar_url ?? null,
        };
        return { kind: 'review', likedAt: reviewLikedAt.get(r.id)!, review };
      });

      const listEntries: MyLikeEntry[] = lists.map((l) => {
        const tuples = itemsByList.get(l.id) ?? [];
        const list: ListSummary = {
          id: l.id,
          title: l.title,
          description: l.description,
          itemCount: tuples.length,
          countLabel: listCountLabel(tuples),
          posters: tuples.slice(0, 4).map((t) =>
            resolveScope({ tmdb_show_id: t.tmdb_show_id, season_number: t.season_number, episode_number: t.episode_number }, cards.get(t.tmdb_show_id)).posterPath,
          ),
        };
        return { kind: 'list', likedAt: listLikedAt.get(l.id)!, list };
      });

      return [...reviewEntries, ...listEntries].sort((a, b) => Date.parse(b.likedAt) - Date.parse(a.likedAt));
    },
  });
}
