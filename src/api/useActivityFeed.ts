import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchShowCards } from '@/api/showCards';
import { formatScope, resolveScope } from '@/types';
import type { ActivityActor, ActivityItem } from '@/types';

const SRC_LIMIT = 30; // newest N per source — the merged feed can only contain a
//                       row that's in some source's newest-N, so this suffices.
const FEED_LIMIT = 40; // final merged size

// Rating lookup key (per actor, per exact scope). String key serializes null
// safely — the CLAUDE.md "merge scoped tables in JS, never a SQL join" rule.
const ratingKey = (user: string, show: number, s: number | null, e: number | null) =>
  `${user}:${show}:${s}:${e}`;

export type ActivityMode = 'friends' | 'you';

/**
 * The Activity feed — a single time-ordered stream of social actions. Two modes
 * over ONE builder:
 *   - 'friends' → the people you follow
 *   - 'you'     → your own actions ("You watched…", "You liked…")
 * Actions covered: watched (show-scope), watchlist-add, review, list, LIKE (review
 * or list), and FOLLOW. Built entirely from direct social-table reads (no Edge
 * Function — the catalog-via-EF rule is about the TMDb *key*, untouched here),
 * merged + sorted in JS.
 */
export function useActivityFeed(mode: ActivityMode = 'friends') {
  const { user } = useAuth();
  const me = user?.id;

  return useQuery<ActivityItem[]>({
    queryKey: ['activity', mode, me],
    enabled: !!me,
    queryFn: async () => {
      // Whose actions this feed shows. 'you' = just me; 'friends' = my followees.
      let actorIds: string[];
      if (mode === 'you') {
        actorIds = [me!];
      } else {
        const { data: edges, error: fErr } = await supabase
          .from('follows').select('followee_id').eq('follower_id', me!);
        if (fErr) throw fErr;
        actorIds = (edges ?? []).map((e) => (e as { followee_id: string }).followee_id);
        if (actorIds.length === 0) return [];
      }

      // 1. Newest activity from each source (parallel). Watched/Watchlist are
      //    show-scope only (no episode/season — keeps the feed digestible).
      const [watchedRes, watchlistRes, reviewRes, listRes, reviewLikeRes, listLikeRes, followRes] =
        await Promise.all([
          supabase.from('watch_status')
            .select('user_id, tmdb_show_id, updated_at')
            .in('user_id', actorIds).eq('status', 'watched')
            .is('season_number', null).is('episode_number', null)
            .order('updated_at', { ascending: false }).limit(SRC_LIMIT),
          supabase.from('watch_status')
            .select('user_id, tmdb_show_id, updated_at')
            .in('user_id', actorIds).eq('status', 'watchlist')
            .is('season_number', null).is('episode_number', null)
            .order('updated_at', { ascending: false }).limit(SRC_LIMIT),
          supabase.from('reviews')
            .select('id, user_id, tmdb_show_id, season_number, episode_number, body, contains_spoilers, created_at')
            .in('user_id', actorIds)
            .eq('is_draft', false) // never surface drafts in the feed
            .order('created_at', { ascending: false }).limit(SRC_LIMIT),
          supabase.from('lists')
            .select('id, user_id, title, created_at')
            .in('user_id', actorIds)
            .eq('is_draft', false) // a draft isn't a published action — keep it out of the feed
            .order('created_at', { ascending: false }).limit(SRC_LIMIT),
          supabase.from('review_likes')
            .select('user_id, review_id, created_at')
            .in('user_id', actorIds)
            .order('created_at', { ascending: false }).limit(SRC_LIMIT),
          supabase.from('list_likes')
            .select('user_id, list_id, created_at')
            .in('user_id', actorIds)
            .order('created_at', { ascending: false }).limit(SRC_LIMIT),
          supabase.from('follows')
            .select('follower_id, followee_id, created_at')
            .in('follower_id', actorIds)
            .order('created_at', { ascending: false }).limit(SRC_LIMIT),
        ]);
      for (const r of [watchedRes, watchlistRes, reviewRes, listRes, reviewLikeRes, listLikeRes, followRes])
        if (r.error) throw r.error;

      const watched = (watchedRes.data ?? []) as { user_id: string; tmdb_show_id: number; updated_at: string }[];
      const watchlist = (watchlistRes.data ?? []) as { user_id: string; tmdb_show_id: number; updated_at: string }[];
      const reviews = (reviewRes.data ?? []) as {
        id: string; user_id: string; tmdb_show_id: number;
        season_number: number | null; episode_number: number | null;
        body: string; contains_spoilers: boolean; created_at: string;
      }[];
      const lists = (listRes.data ?? []) as { id: string; user_id: string; title: string; created_at: string }[];
      const reviewLikes = (reviewLikeRes.data ?? []) as { user_id: string; review_id: string; created_at: string }[];
      const listLikes = (listLikeRes.data ?? []) as { user_id: string; list_id: string; created_at: string }[];
      const follows = (followRes.data ?? []) as { follower_id: string; followee_id: string; created_at: string }[];

      // 2. Resolve the LIKE targets (the review/list that was liked) + list
      //    previews — all parallel, all keyed off ids we now have.
      const likedReviewIds = [...new Set(reviewLikes.map((l) => l.review_id))];
      const likedListIds = [...new Set(listLikes.map((l) => l.list_id))];
      const [listItemsRes, likedReviewRes, likedListRes] = await Promise.all([
        lists.length
          ? supabase.from('list_items').select('list_id, tmdb_show_id, position, added_at')
              .in('list_id', lists.map((l) => l.id))
              .order('position', { ascending: true }).order('added_at', { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        likedReviewIds.length
          ? supabase.from('reviews')
              .select('id, user_id, tmdb_show_id, season_number, episode_number')
              .in('id', likedReviewIds).eq('is_draft', false) // a liked review since unpublished drops out
          : Promise.resolve({ data: [], error: null }),
        likedListIds.length
          ? supabase.from('lists').select('id, user_id, title').in('id', likedListIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (listItemsRes.error) throw listItemsRes.error;
      if (likedReviewRes.error) throw likedReviewRes.error;
      if (likedListRes.error) throw likedListRes.error;

      const showsByList = new Map<string, number[]>();
      for (const row of (listItemsRes.data ?? []) as { list_id: string; tmdb_show_id: number }[]) {
        const arr = showsByList.get(row.list_id) ?? [];
        arr.push(row.tmdb_show_id);
        showsByList.set(row.list_id, arr);
      }
      const likedReviewById = new Map<string, { user_id: string; tmdb_show_id: number; season_number: number | null; episode_number: number | null }>();
      for (const r of (likedReviewRes.data ?? []) as { id: string; user_id: string; tmdb_show_id: number; season_number: number | null; episode_number: number | null }[]) {
        likedReviewById.set(r.id, r);
      }
      const likedListById = new Map<string, { user_id: string; title: string }>();
      for (const l of (likedListRes.data ?? []) as { id: string; user_id: string; title: string }[]) {
        likedListById.set(l.id, { user_id: l.user_id, title: l.title });
      }

      // 3. Collect ids to enrich (shows for posters, profiles for every named person).
      const showIds = new Set<number>();
      watched.forEach((w) => showIds.add(w.tmdb_show_id));
      watchlist.forEach((w) => showIds.add(w.tmdb_show_id));
      reviews.forEach((r) => showIds.add(r.tmdb_show_id));
      for (const arr of showsByList.values()) arr.slice(0, 4).forEach((id) => showIds.add(id));
      likedReviewById.forEach((r) => showIds.add(r.tmdb_show_id));

      const profileIds = new Set<string>();
      [...watched, ...watchlist, ...reviews, ...lists].forEach((r) => profileIds.add(r.user_id));
      reviewLikes.forEach((l) => profileIds.add(l.user_id));
      listLikes.forEach((l) => profileIds.add(l.user_id));
      follows.forEach((f) => { profileIds.add(f.follower_id); profileIds.add(f.followee_id); });
      likedReviewById.forEach((r) => profileIds.add(r.user_id)); // review owners ("liked Lara's review")
      likedListById.forEach((l) => profileIds.add(l.user_id));   // list owners

      // Ratings only matter for watched + review rows (their own scope).
      const ratedShowIds = [...new Set([...watched.map((w) => w.tmdb_show_id), ...reviews.map((r) => r.tmdb_show_id)])];

      const [profilesRes, cards, ratingsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', [...profileIds]),
        fetchShowCards([...showIds], { withScopeArt: true }), // scope art for scoped reviews
        ratedShowIds.length
          ? supabase.from('ratings').select('user_id, tmdb_show_id, season_number, episode_number, score')
              .in('user_id', actorIds).in('tmdb_show_id', ratedShowIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (ratingsRes.error) throw ratingsRes.error;

      const actorById = new Map<string, ActivityActor>();
      for (const p of (profilesRes.data ?? []) as { id: string; username: string; display_name: string | null; avatar_url: string | null }[]) {
        actorById.set(p.id, { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
      }
      const ratingByScope = new Map<string, number>();
      for (const r of (ratingsRes.data ?? []) as {
        user_id: string; tmdb_show_id: number; season_number: number | null; episode_number: number | null; score: number;
      }[]) {
        ratingByScope.set(ratingKey(r.user_id, r.tmdb_show_id, r.season_number, r.episode_number), r.score);
      }

      const actor = (uid: string): ActivityActor =>
        actorById.get(uid) ?? { id: uid, username: 'someone', display_name: null, avatar_url: null };
      const nameOf = (uid: string): string => {
        const a = actorById.get(uid);
        return a ? (a.display_name ?? a.username) : 'someone';
      };
      const card = (sid: number) =>
        cards.get(sid) ?? { tmdb_show_id: sid, name: 'Untitled', poster_path: null };

      // 4. Build a typed item per source, then merge + sort newest-first.
      const items: ActivityItem[] = [];

      for (const w of watched) {
        items.push({
          type: 'watched',
          key: `watched:${w.user_id}:${w.tmdb_show_id}:${w.updated_at}`,
          actor: actor(w.user_id), at: w.updated_at,
          show: card(w.tmdb_show_id),
          rating: ratingByScope.get(ratingKey(w.user_id, w.tmdb_show_id, null, null)) ?? null,
        });
      }
      for (const w of watchlist) {
        items.push({
          type: 'watchlist',
          key: `watchlist:${w.user_id}:${w.tmdb_show_id}:${w.updated_at}`,
          actor: actor(w.user_id), at: w.updated_at, show: card(w.tmdb_show_id),
        });
      }
      for (const r of reviews) {
        const scoped = resolveScope(
          { tmdb_show_id: r.tmdb_show_id, season_number: r.season_number, episode_number: r.episode_number },
          cards.get(r.tmdb_show_id),
        );
        items.push({
          type: 'reviewed', key: `review:${r.id}`,
          actor: actor(r.user_id), at: r.created_at,
          show: { ...card(r.tmdb_show_id), poster_path: scoped.posterPath },
          scopeLabel: formatScope(r.season_number, r.episode_number) ?? null,
          rating: ratingByScope.get(ratingKey(r.user_id, r.tmdb_show_id, r.season_number, r.episode_number)) ?? null,
          body: r.body, containsSpoilers: r.contains_spoilers,
        });
      }
      for (const l of lists) {
        const arr = showsByList.get(l.id) ?? [];
        items.push({
          type: 'listed', key: `list:${l.id}`,
          actor: actor(l.user_id), at: l.created_at,
          listId: l.id, title: l.title, count: arr.length,
          posters: arr.slice(0, 4).map((sid) => card(sid).poster_path),
        });
      }
      for (const lk of reviewLikes) {
        const rev = likedReviewById.get(lk.review_id);
        if (!rev) continue; // draft/deleted → no row to point at
        const scoped = resolveScope(
          { tmdb_show_id: rev.tmdb_show_id, season_number: rev.season_number, episode_number: rev.episode_number },
          cards.get(rev.tmdb_show_id),
        );
        items.push({
          type: 'liked', target: 'review',
          key: `rlike:${lk.user_id}:${lk.review_id}:${lk.created_at}`,
          actor: actor(lk.user_id), at: lk.created_at,
          reviewId: lk.review_id,
          show: { ...card(rev.tmdb_show_id), poster_path: scoped.posterPath },
          scopeLabel: formatScope(rev.season_number, rev.episode_number) ?? null,
          ownerName: nameOf(rev.user_id),
        });
      }
      for (const lk of listLikes) {
        const lst = likedListById.get(lk.list_id);
        if (!lst) continue;
        items.push({
          type: 'liked', target: 'list',
          key: `llike:${lk.user_id}:${lk.list_id}:${lk.created_at}`,
          actor: actor(lk.user_id), at: lk.created_at,
          listId: lk.list_id, title: lst.title, ownerName: nameOf(lst.user_id),
        });
      }
      for (const f of follows) {
        items.push({
          type: 'followed',
          key: `follow:${f.follower_id}:${f.followee_id}:${f.created_at}`,
          actor: actor(f.follower_id), at: f.created_at,
          target: actor(f.followee_id),
        });
      }

      return items
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, FEED_LIMIT);
    },
  });
}
