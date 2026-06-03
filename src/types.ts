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
  // Cast/crew from append_to_response=credits (see _shared/tmdb.ts). Optional —
  // payloads cached before that change have no `credits` (get-show backfills on
  // first view). The Overview tab reads `credits.cast`.
  credits?: TmdbCredits;
  // Per-country TV content ratings (TV-MA / TV-14 / ...). We read the US rating
  // for the meta line. Appended alongside credits.
  content_ratings?: { results?: TmdbContentRating[] };
  // Where-to-watch, per country, sourced from JustWatch (attribution required when
  // shown). The KEY literally contains a slash, so it's bracket-accessed:
  // `payload['watch/providers']?.results?.US?.flatrate`.
  'watch/providers'?: { results?: Record<string, WatchProviderCountry> };
  external_ids?: { imdb_id?: string | null };
  // OMDb enrichment (TMDb's API has no awards) — merged in by get-show. `awards`
  // is OMDb's freeform string, e.g. "Won 16 Primetime Emmys. Another 90 wins…".
  omdb?: { awards: string | null };
};

export type TmdbContentRating = { iso_3166_1: string; rating: string };

// A streaming/buy/rent provider for one country (logo + name).
export type WatchProvider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number; // TMDb's ordering hint; lower = show first
};

export type WatchProviderCountry = {
  link?: string;             // JustWatch deep link for this title+country
  flatrate?: WatchProvider[]; // subscription streaming ("where to watch")
  rent?: WatchProvider[];
  buy?: WatchProvider[];
};

// A billed cast member from TMDb /tv/{id}?append_to_response=credits. `order` is
// TMDb's billing rank (0 = top-billed) — we show the first ~12.
export type TmdbCastMember = {
  id: number;
  name: string;              // the actor
  character?: string;        // the role they play
  profile_path?: string | null; // headshot (→ tmdbImage)
  order?: number;
};

export type TmdbCredits = {
  cast?: TmdbCastMember[];
  crew?: Array<{ id: number; name: string; job?: string }>;
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
  is_draft: boolean; // unpublished — filtered out of every public review query
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
// `backdrop_path` is OPTIONAL: only `fetchShowCards` populates it (for the
// review-detail hero), so the many places that build a card by hand don't all
// have to start supplying it.
export type ShowCard = {
  tmdb_show_id: number;
  name: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  // Per-scope art (season posters, episode stills + names), populated ONLY when
  // fetchShowCards is asked for it ({ withScopeArt }). Lets resolveScope render a
  // season/episode's own art + identity without a new fetch — it's data the
  // payload already carried. Absent on the slim cards everyone else uses.
  scopeArt?: ScopeArt;
};

export type ScopeArt = {
  seasons: Record<number, {
    poster_path: string | null;
    episodes: Record<number, { name: string; still_path: string | null }>;
  }>;
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

// One of the signed-in user's OWN reviews — powers Profile › Your record →
// Reviews. Enriched with its show card + the rating for THAT exact scope
// (string-key JS merge, never a SQL join on nullable scope) + a like count.
// The author is always the viewer, so identity is supplied by the screen once,
// not repeated per row.
export type MyReviewEntry = {
  id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  showName: string;
  posterPath: string | null;
  rating: number | null; // the user's rating for this exact scope, if any
  likes: number;
};

// One review opened in full on /review/[id]. Composes the review row, the
// reviewer's identity, the rating for THIS exact scope, and the show card
// (incl. backdrop for the hero) — everything the page renders in one shape.
// Published only: useReviewDetail filters drafts out, so this never carries one.
export type ReviewDetail = {
  id: string;
  user_id: string;
  tmdb_show_id: number;
  season_number: number | null;
  episode_number: number | null;
  body: string;
  contains_spoilers: boolean;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  likes: number;
  rating: number | null; // the reviewer's rating for this exact scope, if any
  showName: string;
  posterPath: string | null;
  backdropPath: string | null;
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

// A list item enriched for the ranked detail rows: the card + a year and network
// for the subtitle line ("HBO · 2019").
export type ListShowItem = ShowCard & {
  // Scope of this list row (a list can hold a show, a season, or an episode).
  // `name`/`poster_path` are already resolved to THIS scope (resolveScope).
  season_number: number | null;
  episode_number: number | null;
  scopeKey: string;       // unique per row — a show can appear at multiple scopes
  year: string | null;    // first_air_date's year, e.g. "2019"
  network: string | null; // primary broadcaster, e.g. "HBO"
};

// A list opened in detail — its shows (in position order) + creator identity.
export type ListDetail = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_ranked: boolean;
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  createdAt: string; // ISO timestamp from lists.created_at
  // Render seam for a future pick-your-own banner. No DB column yet, so this is
  // always null today — the detail screen does `bannerUrl ? custom : auto-composite`.
  bannerUrl: string | null;
  items: ListShowItem[];
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

// Compact scope label shared by the Log confirmation line AND the rich episode
// rows, so the same scope reads identically everywhere. Whole show → undefined
// (callers use the show name); season → "Season 2"; episode → "S01 · E03"
// (zero-padded so list rows align).
export function formatScopeShort(
  season: number | null,
  episode: number | null,
): string | undefined {
  if (season === null) return undefined;
  if (episode === null) return `Season ${season}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `S${pad(season)} · E${pad(episode)}`;
}

// "2020-10-23" → "Oct 23, 2020". Manual (no Intl — Hermes ships without it).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatAirDate(d?: string | null): string | null {
  if (!d) return null;
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return null;
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}

export type ScopeTuple = { tmdb_show_id: number; season_number: number | null; episode_number: number | null };
export type ResolvedScope = { posterPath: string | null; title: string; key: string };

// THE single source of a scoped row's poster + identity + React key, for every
// surface that shows a scope (list rows, review cards, …). Reuses formatScopeShort
// for the label (no second formatter) and falls back UP the hierarchy for art:
// episode still → season poster → show poster. `card.scopeArt` is present only
// when fetched with { withScopeArt }; without it, art falls back to the show
// poster but the title/key are still correct from the tuple. Returns a `posterPath`
// (a TMDb path the existing Poster/Image components turn into a URL), not a URL.
export function resolveScope(tuple: ScopeTuple, card: ShowCard | undefined): ResolvedScope {
  const { tmdb_show_id, season_number, episode_number } = tuple;
  const key = `${tmdb_show_id}-${season_number ?? 'x'}-${episode_number ?? 'x'}`;
  const showPoster = card?.poster_path ?? null;

  if (season_number === null) {
    return { posterPath: showPoster, title: card?.name ?? 'Untitled', key };
  }

  const season = card?.scopeArt?.seasons[season_number];
  if (episode_number === null) {
    return { posterPath: season?.poster_path ?? showPoster, title: `Season ${season_number}`, key };
  }

  const ep = season?.episodes[episode_number];
  const label = formatScopeShort(season_number, episode_number)!; // "S01 · E03"
  return {
    posterPath: ep?.still_path ?? season?.poster_path ?? showPoster,
    title: ep?.name ? `${label} ‘${ep.name}’` : label,
    key,
  };
}

// Build the slim per-scope art lookup (season posters + episode stills/names)
// from a cached TMDb payload. Used by fetchShowCards (withScopeArt) and by
// surfaces that already hold the full catalog (the show Reviews tab) to feed
// resolveScope without a refetch.
export function buildScopeArt(payload: TmdbPayload | undefined): ScopeArt {
  const seasons: ScopeArt['seasons'] = {};
  for (const s of payload?.seasons ?? []) {
    const episodes: ScopeArt['seasons'][number]['episodes'] = {};
    for (const e of s.episodes ?? []) {
      episodes[e.episode_number] = { name: e.name, still_path: e.still_path ?? null };
    }
    seasons[s.season_number] = { poster_path: s.poster_path ?? null, episodes };
  }
  return { seasons };
}

// ----- TMDb image URL helper -----------------------------------------------
// TMDb returns paths like "/abc.jpg" — the real URL needs a base + size.
// w342 fits shelf posters; w500/w780 for the detail hero; original for zooms.

export type ImageSize = 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function tmdbImage(
  path: string | null | undefined,
  size: ImageSize = 'w342',
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
