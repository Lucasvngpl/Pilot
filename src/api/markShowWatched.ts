import { supabase } from '@/lib/supabase';

// Materialize show-scope "watched" — the single write that TASK 1's two callers
// (useRate, usePostReview) share so the "logging ⇒ watched" rule can't drift.
// Idempotent UPSERT: ON CONFLICT updates status to 'watched', so it supersedes a
// prior 'watchlist'/'watching' (you rated/reviewed it ⇒ you finished it).
export async function markShowWatched(userId: string, tmdbShowId: number) {
  const { error } = await supabase.from('watch_status').upsert(
    { user_id: userId, tmdb_show_id: tmdbShowId, season_number: null, episode_number: null, status: 'watched' },
    { onConflict: 'user_id,tmdb_show_id,season_number,episode_number' },
  );
  if (error) throw error;
}
