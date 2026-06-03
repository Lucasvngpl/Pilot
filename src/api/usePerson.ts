import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
// `import type` brings in ONLY the type for the compiler — it's erased at build
// time, so it adds zero runtime code (vs a normal `import` which ships a value).
import type { Person } from '@/types';

// usePerson — the CLIENT half of the get-person Edge Function. The screen calls
// this hook; the hook calls the function; the function calls TMDb with the secret
// key. (Bio + headshot + the TV shows an actor appears in.)
//
// `personId: number | undefined` because the caller reads it from a route param
// that may not be ready on the first render — the `enabled` gate below covers that.
export function usePerson(personId: number | undefined) {
  // useQuery handles the whole async lifecycle (loading / data / error / caching).
  // The <Person> generic types what it RETURNS, so callers get a typed
  // `data: Person | undefined` with no manual casting.
  return useQuery<Person>({
    // The cache key. React Query caches by this key: same key → reuse the cached
    // result; it includes personId so every actor caches independently.
    queryKey: ['person', personId],
    // Only run once we actually have a valid id. `!!x` coerces anything to a
    // boolean (undefined → false), so the query never fires with no id.
    enabled: !!personId && Number.isInteger(personId),
    // queryFn = the actual fetch. `async` makes it return a Promise; `await`
    // pauses until the call resolves.
    queryFn: async () => {
      // invoke() POSTs to our Edge Function over HTTP. The <Person> generic types
      // the response `data`; `body` is the JSON the function reads as its input.
      const { data, error } = await supabase.functions.invoke<Person>('get-person', {
        body: { person_id: personId },
      });
      // Throwing here tells React Query the query FAILED (so `isError` flips true);
      // returning is the success path (the value becomes `data` for the caller).
      if (error) throw error;
      if (!data) throw new Error('Person not found');
      return data;
    },
  });
}
