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
  // The calendar day the user says they watched this scope ("YYYY-MM-DD", a
  // Postgres DATE — timezone-free). Defaults to the mark date; the Review-or-log
  // composer can set a custom day. Diary + Profile→Shows→Watched order by this.
  watched_at: string;
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

// A TV show a person appears in (from get-person's tv_credits mapping).
export type PersonShow = {
  tmdb_show_id: number;
  name: string;
  poster_path: string | null;
  character: string | null;
  year: string | null;
};

// Actor/cast page (get-person): bio + headshot + the shows they appear in.
export type Person = {
  id: number;
  name: string;
  biography: string | null;
  profile_path: string | null;
  shows: PersonShow[];
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
  seasonNumber: number | null;  // scope of this event — drives the tap route (PIL-6)
  episodeNumber: number | null; // and the per-scope poster (PIL-12)
  year: string | null;       // first_air_date year, e.g. "1972"
  scopeLabel: string | null; // null = whole show; "Season 2"; "Season 2 · E5"
  watchedAt: string;         // the watched_at date ("YYYY-MM-DD"), timezone-free
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
    })
  // A like on someone's review or list. `ownerName` is whose thing was liked
  // ("liked Lara's review of …"); for a review we carry enough to render the
  // poster + scope, for a list just title + id.
  | (ActivityBase & {
      type: 'liked'; target: 'review';
      reviewId: string; show: ShowCard; scopeLabel: string | null; ownerName: string;
    })
  | (ActivityBase & {
      type: 'liked'; target: 'list';
      listId: string; title: string; ownerName: string;
    })
  // A follow — `target` is the person who got followed.
  | (ActivityBase & { type: 'followed'; target: ActivityActor });

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

// ----- My Likes (own-only record) ------------------------------------------
// What the signed-in user has liked. A liked REVIEW carries the REVIEWER's
// identity (it's someone else's review, unlike MyReviewEntry where the author is
// the viewer); a liked LIST is just a ListSummary the ListCard can render. Each
// entry keeps `likedAt` (the like row's created_at) so the page sorts by when YOU
// liked it, not when the thing was made.
export type LikedReview = {
  reviewId: string;
  tmdb_show_id: number;
  showName: string;
  posterPath: string | null;
  seasonLabel?: string;            // formatScope(season, episode) — undefined for whole-show
  rating: number;                  // reviewer's rating for that scope (0 = none)
  body: string;
  containsSpoilers: boolean;
  likes: number;
  reviewerUsername: string;
  reviewerDisplayName: string | null;
  reviewerAvatarUrl: string | null;
};

export type MyLikeEntry =
  | { kind: 'review'; likedAt: string; review: LikedReview }
  | { kind: 'list'; likedAt: string; list: ListSummary };

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

// ----- Comments ------------------------------------------------------------
// Flat (non-threaded) comments on a review or a list. The polymorphic target is
// (target_type, target_id) — same nullable-scope discipline the social tables use,
// but here both columns are NOT NULL since a comment always points at exactly one
// thing. Enriched server-side (get-comments) with the commenter's profile.

export type CommentTargetType = 'review' | 'list';

export type CommentWithMeta = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type GetCommentsResponse = {
  comments: CommentWithMeta[];
};

// ----- Moderation (report + block) -----------------------------------------
// The App Store Guideline 1.2 pair that lets comments ship. A report flags any
// piece of others' UGC for the manual admin-removal queue; a block globally hides
// a user's content from the blocker and tears down the follow edges both ways.

export type ReportTargetType = 'review' | 'list' | 'comment' | 'profile';

// The canned reasons shown in the report sheet (a free-text "other" could be added
// later; the report→remove loop is what 1.2 actually gates on).
export type ReportReason =
  | 'Spam'
  | 'Harassment or hate'
  | 'Inappropriate content'
  | 'Spoilers'
  | 'Other';

// The reasons in display order, for the report sheet. A runtime array next to the
// type so the picker can `.map` it (a TS union has no value to iterate).
export const REPORT_REASONS: ReportReason[] = [
  'Spam',
  'Harassment or hate',
  'Inappropriate content',
  'Spoilers',
  'Other',
];

// A user the signed-in user has blocked — rendered in Settings › Blocked users.
export type BlockedUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  blocked_at: string;
};

// ----- Incoming activity (the "Incoming" lane) -----------------------------
// Actions OTHERS took on YOUR content — the in-app notification surface. A
// discriminated union, like ActivityItem, but oriented around "you" as the
// recipient ("X commented on your review", "X liked your list", "X followed you").
type IncomingBase = { key: string; actor: ActivityActor; at: string };

export type IncomingItem =
  | (IncomingBase & {
      type: 'comment';
      target: 'review' | 'list';
      reviewId?: string;          // present when target === 'review'
      listId?: string;            // present when target === 'list'
      objectLabel: string;        // e.g. "your review of Severance" / "your list Top Crime"
      body: string;               // the comment text (snippet)
    })
  | (IncomingBase & {
      type: 'liked';
      target: 'review' | 'list';
      reviewId?: string;
      listId?: string;
      objectLabel: string;
    })
  | (IncomingBase & { type: 'followed' });

// ----- Likes ---------------------------------------------------------------

// The like state for ONE target (a review or a list), read together in a single
// hook (useReviewLikes / useListLikes). `count` is the EXACT total; `likers` is a
// capped slice (≤5) for the avatar cluster — never the full list (cheap read).
// `likedByMe` answers "is my like row present" and drives the filled heart.
export type LikeState = {
  count: number;
  likedByMe: boolean;
  likers: ViewerAvatar[]; // ≤5 profiles for the cluster (id, username, avatar_url)
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
  countLabel: string;         // scope-aware ("5 seasons", "3 episodes", "N items")
  posters: (string | null)[]; // up to 4 poster_paths for the card preview
};

// Scope-aware count label for a list, from the SAME nullable-scope encoding
// resolveScope reads (season null → show, episode null → season, else episode).
// All-one-scope → "N shows/seasons/episodes"; mixed → a neutral "N items" — so
// "Stranger things seasons ranked" reads "5 seasons", not "5 shows". Plurals
// handled ("1 show", not "1 shows").
export function listCountLabel(
  items: { season_number: number | null; episode_number: number | null }[],
): string {
  const n = items.length;
  if (n === 0) return 'Empty';
  let shows = 0, seasons = 0, episodes = 0;
  for (const it of items) {
    if (it.season_number === null) shows += 1;
    else if (it.episode_number === null) seasons += 1;
    else episodes += 1;
  }
  const plural = (c: number, one: string) => `${c} ${c === 1 ? one : `${one}s`}`;
  if (seasons === 0 && episodes === 0) return plural(shows, 'show');
  if (shows === 0 && episodes === 0) return plural(seasons, 'season');
  if (shows === 0 && seasons === 0) return plural(episodes, 'episode');
  return `${n} items`; // mixed scopes
}

// A list item enriched for the ranked detail rows: the card + a year and network
// for the subtitle line ("HBO · 2019").
export type ListShowItem = ShowCard & {
  // Scope of this list row (a list can hold a show, a season, or an episode).
  // `name`/`poster_path` are already resolved to THIS scope (resolveScope).
  season_number: number | null;
  episode_number: number | null;
  scopeKey: string;       // unique per row — a show can appear at multiple scopes
  // The bare SHOW name (not the resolved scope title) — so an editor row can show
  // "True Detective" on top with the scope ("S01 · E05 …") underneath. For a
  // whole-show row this equals `name`.
  showName: string;
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
  is_draft: boolean; // unpublished — own-only; the composer reads this to offer Publish
  ownerUsername: string | null;
  ownerAvatarUrl: string | null;
  createdAt: string; // ISO timestamp from lists.created_at
  // Custom banner (owner-picked TMDb backdrop). `bannerUrl` is the ready-to-render
  // image URL (null = fall back to the auto-composite); `bannerBackdropPath` is the
  // raw TMDb path the banner picker compares against to mark the current selection.
  bannerUrl: string | null;
  bannerBackdropPath: string | null;
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

// The route a scoped poster/row should open. Mirrors the show-detail route tree:
// whole-show → the show landing, season → that season's episode list, episode →
// the episode detail. Single source of truth so every tappable scoped item
// (Poster, Diary, lists…) navigates to the same place for the same scope (PIL-6).
export function scopeHref(
  showId: number,
  season: number | null,
  episode: number | null,
): string {
  if (season === null) return `/show/${showId}`;
  if (episode === null) return `/show/${showId}/season?season=${season}`;
  return `/show/${showId}/episode?season=${season}&episode=${episode}`;
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

// ----- Watched-date helpers ------------------------------------------------
// `watched_at` is a Postgres DATE (a calendar day, no time, no timezone). We
// serialize it as "YYYY-MM-DD" and ALWAYS build it from LOCAL date parts — never
// `toISOString()`, which is UTC and can land on the wrong day near midnight.

const pad2 = (n: number) => String(n).padStart(2, '0');

// A JS Date → "YYYY-MM-DD" using the device's LOCAL calendar day.
export function fromLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Today's local calendar day as "YYYY-MM-DD". The default for every quick-mark.
export function todayLocal(): string {
  return fromLocalDate(new Date());
}

// "YYYY-MM-DD" → a Date at LOCAL midnight of that day (for feeding a date picker).
// Split-parse, NOT `new Date(str)` — the latter parses as UTC midnight and can
// shift the day in negative-offset timezones.
export function toLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
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
