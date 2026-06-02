import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WatchedFilter } from '@/api/useWatchedShows';

const KEY = 'pilot.showsFilter.v1';

// Persisted Shows-tab filter (Watched / Watching / null=all). Loads async on
// mount; until it resolves we render the default 'watched' — a correct default,
// not a flash of the wrong thing. Writes through on every change. `null` is
// stored as the string 'all' (AsyncStorage only holds strings).
export function useShowsFilter(): [WatchedFilter, (f: WatchedFilter) => void] {
  const [filter, setFilter] = useState<WatchedFilter>('watched');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'watched' || v === 'watching') setFilter(v);
      else if (v === 'all') setFilter(null);
    });
  }, []);

  const update = (f: WatchedFilter) => {
    setFilter(f);
    AsyncStorage.setItem(KEY, f ?? 'all').catch(() => {});
  };

  return [filter, update];
}
