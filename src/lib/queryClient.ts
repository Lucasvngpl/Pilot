import { QueryClient } from '@tanstack/react-query';

// staleTime = how long cached data is considered "fresh"; during this window
// we don't refetch on mount, focus, or reconnect. TV catalog data is slow-
// moving, so 5 min is comfortable. Hooks can override per-query.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
