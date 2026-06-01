// Canonical TMDb TV genres (the /genre/tv/list set). Hardcoded rather than
// fetched live: the list is fixed and changes maybe once a decade, so a network
// round-trip would buy nothing. We filter shows_cache by genre **id** (canonical,
// stable) not name (localizable) — see useShowsByGenre.
//
// Ordered most-browsed first so the rich genres lead the chip row. Our cache is
// popular-heavy (~225 shows), so Drama/Comedy/Action are well-covered while niche
// genres (Documentary, Western, Soap) are sparse until the catalog grows — that
// thinness is the cue to add a TMDb /discover Edge Function later if needed.
export type Genre = { id: number; name: string };

export const TV_GENRES: Genre[] = [
  { id: 18, name: 'Drama' },
  { id: 35, name: 'Comedy' },
  { id: 10759, name: 'Action & Adventure' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 80, name: 'Crime' },
  { id: 16, name: 'Animation' },
  { id: 9648, name: 'Mystery' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 99, name: 'Documentary' },
  { id: 10764, name: 'Reality' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
  { id: 10767, name: 'Talk' },
  { id: 10763, name: 'News' },
  { id: 10766, name: 'Soap' },
];

// Look up a genre's display name from its id (for the section header / empty copy).
export function genreName(id: number): string {
  return TV_GENRES.find((g) => g.id === id)?.name ?? 'Genre';
}
