// useIncomingFeed — the "Incoming" lane of Activity: actions OTHERS took on YOUR
// content (PIL-24's in-app notification surface — no device push this round).
// Covers: comments on your reviews/lists, likes on your reviews/lists, and new
// followers. Built from direct social-table reads (no Edge Function — the
// catalog-via-EF rule is about the TMDb key), merged + sorted newest-first in JS.
//
// Block-filtered like the Friends feed: a blocked user's comment/like/follow never
// notifies you (block hides their interaction everywhere).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { fetchShowCards } from '@/api/showCards';
import { fetchBlockedIds } from '@/api/blocks';
import { formatScope } from '@/types';
import type { ActivityActor, IncomingItem } from '@/types';

const SRC_LIMIT = 30; // newest N per source
const FEED_LIMIT = 40; // final merged size

export function useIncomingFeed() {
  const { user } = useAuth();
  const me = user?.id;

  return useQuery<IncomingItem[]>({
    queryKey: ['activity', 'incoming', me],
    enabled: !!me,
    queryFn: async () => {
      // 1. My OWN content (published only — drafts can't be commented/liked) +
      //    new followers + who I've blocked, all in parallel.
      const [myReviewsRes, myListsRes, followRes, blocked] = await Promise.all([
        supabase
          .from('reviews')
          .select('id, tmdb_show_id, season_number, episode_number')
          .eq('user_id', me!).eq('is_draft', false),
        supabase
          .from('lists')
          .select('id, title')
          .eq('user_id', me!).eq('is_draft', false),
        supabase
          .from('follows')
          .select('follower_id, created_at')
          .eq('followee_id', me!)
          .order('created_at', { ascending: false }).limit(SRC_LIMIT),
        fetchBlockedIds(me),
      ]);
      if (myReviewsRes.error) throw myReviewsRes.error;
      if (myListsRes.error) throw myListsRes.error;
      if (followRes.error) throw followRes.error;

      const myReviews = (myReviewsRes.data ?? []) as {
        id: string; tmdb_show_id: number; season_number: number | null; episode_number: number | null;
      }[];
      const myLists = (myListsRes.data ?? []) as { id: string; title: string }[];
      const follows = ((followRes.data ?? []) as { follower_id: string; created_at: string }[])
        .filter((f) => f.follower_id !== me && !blocked.has(f.follower_id));

      const myReviewById = new Map(myReviews.map((r) => [r.id, r]));
      const myListById = new Map(myLists.map((l) => [l.id, l]));
      const myReviewIds = myReviews.map((r) => r.id);
      const myListIds = myLists.map((l) => l.id);

      // 2. Comments + likes TARGETING my content (exclude my own actions — you
      //    don't notify yourself). Each source skipped when I have no such content.
      const empty = Promise.resolve({ data: [], error: null });
      const [revCommentsRes, listCommentsRes, revLikesRes, listLikesRes] = await Promise.all([
        myReviewIds.length
          ? supabase.from('comments')
              .select('id, user_id, target_id, body, created_at')
              .eq('target_type', 'review').in('target_id', myReviewIds)
              .order('created_at', { ascending: false }).limit(SRC_LIMIT)
          : empty,
        myListIds.length
          ? supabase.from('comments')
              .select('id, user_id, target_id, body, created_at')
              .eq('target_type', 'list').in('target_id', myListIds)
              .order('created_at', { ascending: false }).limit(SRC_LIMIT)
          : empty,
        myReviewIds.length
          ? supabase.from('review_likes')
              .select('user_id, review_id, created_at')
              .in('review_id', myReviewIds)
              .order('created_at', { ascending: false }).limit(SRC_LIMIT)
          : empty,
        myListIds.length
          ? supabase.from('list_likes')
              .select('user_id, list_id, created_at')
              .in('list_id', myListIds)
              .order('created_at', { ascending: false }).limit(SRC_LIMIT)
          : empty,
      ]);
      for (const r of [revCommentsRes, listCommentsRes, revLikesRes, listLikesRes])
        if (r.error) throw r.error;

      // Drop my own + blocked actors up front.
      const mine = (uid: string) => uid === me || blocked.has(uid);
      const revComments = ((revCommentsRes.data ?? []) as { id: string; user_id: string; target_id: string; body: string; created_at: string }[]).filter((c) => !mine(c.user_id));
      const listComments = ((listCommentsRes.data ?? []) as { id: string; user_id: string; target_id: string; body: string; created_at: string }[]).filter((c) => !mine(c.user_id));
      const revLikes = ((revLikesRes.data ?? []) as { user_id: string; review_id: string; created_at: string }[]).filter((l) => !mine(l.user_id));
      const listLikes = ((listLikesRes.data ?? []) as { user_id: string; list_id: string; created_at: string }[]).filter((l) => !mine(l.user_id));

      // 3. Enrich: actor profiles + show names (for "your review of {Show}").
      const profileIds = new Set<string>();
      [...revComments, ...listComments, ...revLikes, ...listLikes].forEach((r) => profileIds.add(r.user_id));
      follows.forEach((f) => profileIds.add(f.follower_id));
      const showIds = new Set<number>();
      revComments.forEach((c) => { const rev = myReviewById.get(c.target_id); if (rev) showIds.add(rev.tmdb_show_id); });
      revLikes.forEach((l) => { const rev = myReviewById.get(l.review_id); if (rev) showIds.add(rev.tmdb_show_id); });

      const [profilesRes, cards] = await Promise.all([
        profileIds.size
          ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', [...profileIds])
          : empty,
        fetchShowCards([...showIds]),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const actorById = new Map<string, ActivityActor>();
      for (const p of (profilesRes.data ?? []) as { id: string; username: string; display_name: string | null; avatar_url: string | null }[]) {
        actorById.set(p.id, { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url });
      }
      const actor = (uid: string): ActivityActor =>
        actorById.get(uid) ?? { id: uid, username: 'someone', display_name: null, avatar_url: null };

      // "your review of {Show}{ · scope}" / "your list {Title}".
      const reviewLabel = (reviewId: string): string => {
        const rev = myReviewById.get(reviewId);
        if (!rev) return 'your review';
        const show = cards.get(rev.tmdb_show_id)?.name ?? 'a show';
        const scope = formatScope(rev.season_number, rev.episode_number);
        return `your review of ${show}${scope ? ` · ${scope}` : ''}`;
      };
      const listLabel = (listId: string): string => {
        const l = myListById.get(listId);
        return l ? `your list ${l.title}` : 'your list';
      };

      // 4. Build typed items per source.
      const items: IncomingItem[] = [];

      for (const c of revComments) {
        items.push({
          type: 'comment', target: 'review', key: `comment:${c.id}`,
          actor: actor(c.user_id), at: c.created_at,
          reviewId: c.target_id, objectLabel: reviewLabel(c.target_id), body: c.body,
        });
      }
      for (const c of listComments) {
        items.push({
          type: 'comment', target: 'list', key: `comment:${c.id}`,
          actor: actor(c.user_id), at: c.created_at,
          listId: c.target_id, objectLabel: listLabel(c.target_id), body: c.body,
        });
      }
      for (const l of revLikes) {
        items.push({
          type: 'liked', target: 'review', key: `rlike:${l.user_id}:${l.review_id}:${l.created_at}`,
          actor: actor(l.user_id), at: l.created_at,
          reviewId: l.review_id, objectLabel: reviewLabel(l.review_id),
        });
      }
      for (const l of listLikes) {
        items.push({
          type: 'liked', target: 'list', key: `llike:${l.user_id}:${l.list_id}:${l.created_at}`,
          actor: actor(l.user_id), at: l.created_at,
          listId: l.list_id, objectLabel: listLabel(l.list_id),
        });
      }
      for (const f of follows) {
        items.push({
          type: 'followed', key: `follow:${f.follower_id}:${f.created_at}`,
          actor: actor(f.follower_id), at: f.created_at,
        });
      }

      return items
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, FEED_LIMIT);
    },
  });
}
