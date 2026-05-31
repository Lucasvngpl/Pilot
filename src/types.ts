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

// The thin episode stub TMDb embeds on a show for its next/last air date —
// NOT a full TmdbEpisode (no overview/still). Only the fields the meta line reads.
export type TmdbAirStub = {
  air_date?: string;
  season_number?: number;
  episode_number?: number;
  name?: string;
};

export type TmdbPayload = {
  id: number;
  name: string;
  overview?: string;
  tagline?: string;        // one-liner, e.g. "May God have mercy."
  status?: string;         // TMDb lifecycle: "Returning Series" | "Ended" | "Canceled" | ...
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  number_of_seasons?: number;
  created_by?: Array<{ id: number; name: string }>;
  genres?: Array<{ id: number; name: string }>;
  // The broadcaster(s) that AIR the show (HBO) — distinct from streaming
  // availability (watch/providers, added separately). All already in the
  // cached /tv/{id} payload; no backend change to read them.
  networks?: Array<{ id: number; name: string; logo_path?: string | null }>;
  next_episode_to_air?: TmdbAirStub | null;
  last_episode_to_air?: TmdbAirStub | null;
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

// Up to 3 viewer faces on the stat row — only people the caller follows.
export type ViewerAvatar = { id: string; username: string; avatar_url: string | null };

export type GetShowResponse = {
  catalog: TmdbPayload;
  mySocial: {
    watch_statuses: WatchStatusRow[];
    ratings: RatingRow[];
    reviews: ReviewRow[];
  };
  // Community stats for the stat row (everyone's rows, not just the caller's).
  stats: {
    avgRating: number | null; // Pilot show-scope average (out of 5); null = no ratings
    ratingCount: number;
    viewers: number; // distinct users who watched or are watching
    viewerAvatars: ViewerAvatar[]; // up to 3, only viewers the caller follows
  };
};

// ----- Profile (Screen 5) --------------------------------------------------

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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

// One Diary row — a single watched event (whole-show / season / episode),
// enriched with its catalog card + the rating/review for THAT exact scope (not
// aggregated up to the show — the diary is event-level by nature).
export type DiaryEntry = ShowCard & {
  key: string;               // unique per entry: `${showId}:${season}:${episode}:${ts}`
  year: string | null;       // first_air_date year, e.g. "1972"
  scopeLabel: string | null; // null = whole show; "Season 2"; "Season 2 · E5"
  watchedAt: string;         // ISO updated_at
  day: number;               // day-of-month, for the date cell
  rating: number | null;     // rating for this scope, if any
  hasReview: boolean;        // a review exists for this scope
};

// Diary grouped into month bands (newest first), e.g. month = "MAY 2026".
export type DiarySection = { month: string; entries: DiaryEntry[] };

// ----- Activity feed (Friends tab) -----------------------------------------
// A row in the feed = one social action by someone the viewer follows. A
// discriminated union on `type` — each variant carries only what its row renders.
export type ActivityActor = { id: string; username: string; display_name: string | null; avatar_url: string | null };

type ActivityBase = { key: string; actor: ActivityActor; at: string }; // at = ISO timestamp

export type ActivityItem =
  | (ActivityBase & { type: 'watched'; show: ShowCard; rating: number | null })
  | (ActivityBase & { type: 'watchlist'; show: ShowCard })
  | (ActivityBase & {
      type: 'reviewed'; show: ShowCard;
      scopeLabel: string | null; rating: number | null;
      body: string; containsSpoilers: boolean;
    })
  | (ActivityBase & {
      type: 'listed'; listId: string; title: string;
      count: number; posters: (string | null)[];
    });

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
  display_name: string | null;
  avatar_url: string | null;
  likes: number;
  rating: number | null;
};

export type GetReviewsResponse = {
  reviews: ReviewWithMeta[];
};

// ----- Search --------------------------------------------------------------

// Slim show result from the search-shows Edge Function (TMDb /search/tv proxy).
export type SearchShowResult = {
  tmdb_show_id: number;
  name: string;
  poster_path: string | null;
  first_air_date: string | null;
};

export type SearchShowsResponse = {
  results: SearchShowResult[];
};

// A person match from the direct `profiles` search (username ilike).
export type PersonResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

// ----- Lists ---------------------------------------------------------------

// A list as shown on the profile Lists tab (count + a few poster previews).
export type ListSummary = {
  id: string;
  title: string;
  description: string | null;
  itemCount: number;
  posters: (string | null)[]; // up to 4 poster_paths for the card preview
};

// A list opened in detail — its shows (ordered) + owner handle.
export type ListDetail = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_ranked: boolean;
  ownerUsername: string | null;
  items: ShowCard[];
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
