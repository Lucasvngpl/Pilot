import { supabase } from '@/lib/supabase';

type Scope = { season_number: number | null; episode_number: number | null };

// Materialize a 'watched' row at ANY scope (show / season / episode) with an
// OPTIONAL chosen day. The single writer for the "logging ⇒ watched" rule, shared
// by useRate (any-scope rating) and the Review-or-log composer (any-scope log) so
// the rule can't drift between them.
//
// Idempotent UPSERT on the scope tuple. Two date behaviours, by design:
//  - watchedAt PASSED → it's in the payload, so ON CONFLICT DO UPDATE sets it:
//    re-logging with a new day MOVES the entry (this is the "edit the date" path).
//  - watchedAt OMITTED → the column is absent from the payload, so a fresh INSERT
//    gets the DB default (current_date = today) and an existing row KEEPS its
//    watched_at untouched. Quick-marks rely on this to mean "watched today" without
//    clobbering a date the user previously chose.
export async function setWatched(
  userId: string,
  tmdbShowId: number,
  scope: Scope = { season_number: null, episode_number: null },
  watchedAt?: string, // "YYYY-MM-DD"; omit → DB default (today)
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    tmdb_show_id: tmdbShowId,
    season_number: scope.season_number,
    episode_number: scope.episode_number,
    status: 'watched',
  };
  if (watchedAt) row.watched_at = watchedAt;
  const { error } = await supabase
    .from('watch_status')
    .upsert(row, { onConflict: 'user_id,tmdb_show_id,season_number,episode_number' });
  if (error) throw error;
}
