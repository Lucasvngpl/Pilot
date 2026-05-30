// Domain types for Pilot. Three groups:
//   - TMDb (catalog) — subset of the JSONB payload we actually read
//   - DB rows        — match the Postgres schema 1:1
//   - Edge Function  — response envelopes returned by get-show / get-popular

export type WatchStatus = 'watching' | 'watched' | 'watchlist';

// ----- TMDb (catalog) ------------------------------------------------------

export type TmdbEpisode = {
  id?: number;
  season_number: number;
  episode_number: number;
  name: string;
  overview?: string;
  air_date?: string;
  runtime?: number | null;
  still_path?: string | null;
};

export type TmdbSeason = {
  id?: number;
  season_number: number;
  name: string;
  air_date?: string;
  poster_path?: string | null;
  overview?: string;
  episodes?: TmdbEpisode[];
};

export type TmdbPayload = {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  created_by?: Array<{ id: number; name: string }>;
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  seasons?: TmdbSeason[];
};

// ----- DB rows (social graph) ----------------------------------------------

export type WatchStatusRow = {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  status: WatchStatus;
  updated_at: string;
};

export type RatingRow = {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  score: number;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
};

// ----- Edge Function responses ---------------------------------------------

export type GetPopularResponse = {
  shows: Array<{ tmdb_show_id: number; payload: TmdbPayload }>;
};

export type GetShowResponse = {
  catalog: TmdbPayload;
  mySocial: {
    watch_statuses: WatchStatusRow[];
    ratings: RatingRow[];
    reviews: ReviewRow[];
  };
};

// ----- Profile (Screen 5) --------------------------------------------------

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

// A show "card" for grids/shelves — the minimal catalog fields we read from
// shows_cache, optionally decorated with per-user overlays below.
export type ShowCard = {
  tmdb_show_id: number;
  name: string;
  poster_path: string | null;
};

export type WatchedCard = ShowCard & {
  rating: number | null; // show-scope rating, if the user rated it
  hasReview: boolean;    // the user has any review for this show
};

export type CurrentlyWatchingCard = ShowCard & {
  episodeLine: string | null; // "S2 E5" from latest watched episode, else null
};

// A review enriched server-side (get-reviews) with reviewer identity, like
// count, and the reviewer's rating for the same scope.
export type ReviewWithMeta = {
  id: string;
  user_id: string;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  username: string;
  avatar_url: string | null;
  likes: number;
  rating: number | null;
};

export type GetReviewsResponse = {
  reviews: ReviewWithMeta[];
};

// Turn a scope into a display line. Whole show → undefined (no line shown).
export function formatScope(
  season: number | null,
  episode: number | null,
): string | undefined {
  if (season === null) return undefined;
  if (episode === null) return `Season ${season}`;
  return `Season ${season} · E${episode}`;
}

// ----- TMDb image URL helper -----------------------------------------------
// TMDb returns paths like "/abc.jpg" — the real URL needs a base + size.
// w342 fits shelf posters; w500/w780 for the detail hero; original for zooms.

export type ImageSize = 'w185' | 'w342' | 'w500' | 'w780' | 'original';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function tmdbImage(
  path: string | null | undefined,
  size: ImageSize = 'w342',
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
