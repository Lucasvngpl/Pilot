import { useEffect, useState } from 'react';

/**
 * Returns `value`, but only after it has stayed unchanged for `delayMs`.
 *
 * Used to hold off search queries until the user pauses typing: each keystroke
 * resets the timer, so the network fires once on pause instead of once per
 * letter. Feed the RESULT of this into a query's key + enabled flag — never the
 * raw input.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id); // cancel the pending update if value changes first
  }, [value, delayMs]);
  return debounced;
}
