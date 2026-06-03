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

/**
 * The Activity "Friends" feed — a single time-ordered stream of what the people
 * you follow have done: watched a show (show-scope only), added one to their
 * watchlist, written a review, or created a list. Built entirely from direct
 * social-table reads (no Edge Function — the catalog-via-EF rule is about the
 * TMDb *key*, which this never touches), merged + sorted in JS.
 */
export function useActivityFeed() {
  const { user } = useAuth();
  const me = user?.id;

  return useQuery<ActivityItem[]>({
    queryKey: ['activity', me],
    enabled: !!me,
    queryFn: async () => {
      // 1. Who do I follow?
      const { data: edges, error: fErr } = await supabase
        .from('follows')
        .select('followee_id')
        .eq('follower_id', me!);
      if (fErr) throw fErr;
      const followees = (edges ?? []).map((e) => (e as { followee_id: string }).followee_id);
      if (followees.length === 0) return [];

      // 2. Newest activity from each source (parallel). Watched/Watchlist are
      //    show-scope only (no episode/season — keeps the feed digestible).
      const [watchedRes, watchlistRes, reviewRes, listRes] = await Promise.all([
        supabase.from('watch_status')
          .select('user_id, tmdb_show_id, updated_at')
          .in('user_id', followees).eq('status', 'watched')
          .is('season_number', null).is('episode_number', null)
          .order('updated_at', { ascending: false }).limit(SRC_LIMIT),
        supabase.from('watch_status')
          .select('user_id, tmdb_show_id, updated_at')
          .in('user_id', followees).eq('status', 'watchlist')
          .is('season_number', null).is('episode_number', null)
          .order('updated_at', { ascending: false }).limit(SRC_LIMIT),
        supabase.from('reviews')
          .select('id, user_id, tmdb_show_id, season_number, episode_number, body, contains_spoilers, created_at')
          .in('user_id', followees)
          .eq('is_draft', false) // never surface a followee's drafts in the feed
          .order('created_at', { ascending: false }).limit(SRC_LIMIT),
        supabase.from('lists')
          .select('id, user_id, title, created_at')
          .in('user_id', followees)
          .order('created_at', { ascending: false }).limit(SRC_LIMIT),
      ]);
      for (const r of [watchedRes, watchlistRes, reviewRes, listRes]) if (r.error) throw r.error;

      const watched = (watchedRes.data ?? []) as { user_id: string; tmdb_show_id: number; updated_at: string }[];
      const watchlist = (watchlistRes.data ?? []) as { user_id: string; tmdb_show_id: number; updated_at: string }[];
      const reviews = (reviewRes.data ?? []) as {
        id: string; user_id: string; tmdb_show_id: number;
        season_number: number | null; episode_number: number | null;
        body: string; contains_spoilers: boolean; created_at: string;
      }[];
      const lists = (listRes.data ?? []) as { id: string; user_id: string; title: string; created_at: string }[];

      // 3. List previews — first 4 show ids per list (+ total count for "(N shows)").
      const showsByList = new Map<string, number[]>();
      if (lists.length > 0) {
        const { data: li, error: liErr } = await supabase
          .from('list_items')
          .select('list_id, tmdb_show_id, position, added_at')
          .in('list_id', lists.map((l) => l.id))
          .order('position', { ascending: true })
          .order('added_at', { ascending: true });
        if (liErr) throw liErr;
        for (const row of (li ?? []) as { list_id: string; tmdb_show_id: number }[]) {
          const arr = showsByList.get(row.list_id) ?? [];
          arr.push(row.tmdb_show_id);
          showsByList.set(row.list_id, arr);
        }
      }

      // 4. Collect ids to enrich.
      const showIds = new Set<number>();
      watched.forEach((w) => showIds.add(w.tmdb_show_id));
      watchlist.forEach((w) => showIds.add(w.tmdb_show_id));
      reviews.forEach((r) => showIds.add(r.tmdb_show_id));
      for (const arr of showsByList.values()) arr.slice(0, 4).forEach((id) => showIds.add(id));

      const actorIds = new Set<string>();
      [...watched, ...watchlist, ...reviews, ...lists].forEach((r) => actorIds.add(r.user_id));

      // Ratings only matter for watched + review rows (their own scope).
      const ratedShowIds = [...new Set([...watched.map((w) => w.tmdb_show_id), ...reviews.map((r) => r.tmdb_show_id)])];

      const [profilesRes, cards, ratingsRes] = await Promise.all([
        supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', [...actorIds]),
        fetchShowCards([...showIds], { withScopeArt: true }), // scope art for scoped reviews
        ratedShowIds.length
          ? supabase.from('ratings').select('user_id, tmdb_show_id, season_number, episode_number, score')
              .in('user_id', followees).in('tmdb_show_id', ratedShowIds)
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
      const card = (sid: number) =>
        cards.get(sid) ?? { tmdb_show_id: sid, name: 'Untitled', poster_path: null };

      // 5. Build a typed item per source, then merge + sort newest-first.
      const items: ActivityItem[] = [];

      for (const w of watched) {
        items.push({
          type: 'watched',
          key: `watched:${w.user_id}:${w.tmdb_show_id}:${w.updated_at}`,
          actor: actor(w.user_id),
          at: w.updated_at,
          show: card(w.tmdb_show_id),
          rating: ratingByScope.get(ratingKey(w.user_id, w.tmdb_show_id, null, null)) ?? null,
        });
      }
      for (const w of watchlist) {
        items.push({
          type: 'watchlist',
          key: `watchlist:${w.user_id}:${w.tmdb_show_id}:${w.updated_at}`,
          actor: actor(w.user_id),
          at: w.updated_at,
          show: card(w.tmdb_show_id),
        });
      }
      for (const r of reviews) {
        // A scoped review shows its season/episode poster; the card's name stays
        // the show name (the row already prints the scopeLabel separately).
        const scoped = resolveScope(
          { tmdb_show_id: r.tmdb_show_id, season_number: r.season_number, episode_number: r.episode_number },
          cards.get(r.tmdb_show_id),
        );
        items.push({
          type: 'reviewed',
          key: `review:${r.id}`,
          actor: actor(r.user_id),
          at: r.created_at,
          show: { ...card(r.tmdb_show_id), poster_path: scoped.posterPath },
          scopeLabel: formatScope(r.season_number, r.episode_number) ?? null,
          rating: ratingByScope.get(ratingKey(r.user_id, r.tmdb_show_id, r.season_number, r.episode_number)) ?? null,
          body: r.body,
          containsSpoilers: r.contains_spoilers,
        });
      }
      for (const l of lists) {
        const arr = showsByList.get(l.id) ?? [];
        items.push({
          type: 'listed',
          key: `list:${l.id}`,
          actor: actor(l.user_id),
          at: l.created_at,
          listId: l.id,
          title: l.title,
          count: arr.length,
          posters: arr.slice(0, 4).map((sid) => card(sid).poster_path),
        });
      }

      return items
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, FEED_LIMIT);
    },
  });
}
