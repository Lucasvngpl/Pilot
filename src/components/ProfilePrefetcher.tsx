import { useEffect } from 'react';
import { Image } from 'expo-image';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/api/useProfile';
import { useCurrentlyWatching } from '@/api/useCurrentlyWatching';
import { useWatchedShows } from '@/api/useWatchedShows';
import { useWatchlist } from '@/api/useWatchlist';
import { useTopShows } from '@/api/useTopShows';
import { useMyLists } from '@/api/useLists';
import { tmdbImage } from '@/types';

// Warms the signed-in user's Profile on app launch, so tapping Profile renders
// instantly instead of each section + poster streaming in. Mounted once at the
// root; renders nothing. No-ops when signed out (every query is enabled:!!userId).
//
// TWO layers:
//  1. DATA — subscribe to the SAME hooks the Profile screen uses (so the keys match
//     exactly and the screen gets cache hits). Each is one cheap batched query, so
//     warming all tabs' data on launch is light — the grid's fetchShowCards is a
//     single `.in(...)` lookup, not N requests.
//  2. IMAGES — prefetch ONLY the landing tab's posters (Top-4 + currently-watching),
//     the ones you see the instant Profile opens. We deliberately do NOT prefetch
//     the whole watched grid's images here: that could be hundreds of downloads and
//     is exactly what would slow startup. Sizes mirror Poster.sizeFor for the widths
//     those surfaces render at (Top-4 slot ≈ w185; the 112px shelf → w342).
export function ProfilePrefetcher() {
  const { user } = useAuth();
  const userId = user?.id;

  useProfile(userId);
  const { data: watching } = useCurrentlyWatching(userId);
  useWatchedShows(userId, 'watched'); // the "have you watched it" set the landing tab reads
  useWatchlist(userId);
  const { data: topShows } = useTopShows(userId);
  useMyLists(userId);

  useEffect(() => {
    const urls: string[] = [];
    for (const t of topShows ?? []) {
      const u = tmdbImage(t.poster_path, 'w185');
      if (u) urls.push(u);
    }
    for (const w of watching ?? []) {
      const u = tmdbImage(w.poster_path, 'w342');
      if (u) urls.push(u);
    }
    if (urls.length) Image.prefetch(urls); // disk-caches them; opening Profile is then a cache hit
  }, [topShows, watching]);

  return null;
}
