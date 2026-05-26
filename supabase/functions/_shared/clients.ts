// Supabase client factories for Edge Functions.
//
// Two distinct "modes":
//
//   userClient(req)
//     - Uses the caller's JWT (forwarded from the Authorization header).
//     - RLS is enforced. `auth.uid()` inside policies returns the caller's id.
//     - Use this for everything that should be scoped to "the current user".
//     - Works for anonymous callers too (no Authorization header, auth.uid()
//       returns NULL, only `for select using (true)` policies match).
//
//   adminClient()
//     - Uses the service_role key. Bypasses RLS entirely.
//     - Use ONLY for things clients can't do themselves: writing to
//       shows_cache, admin queries, etc.
//     - NEVER return its raw results without filtering — it sees everyone's
//       rows.
//
// Env vars (auto-injected into every Edge Function by Supabase):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
// You don't set these in `supabase secrets` — they're free.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function userClient(req: Request): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: {
        // Forward the caller's auth header so PostgREST extracts the JWT and
        // sets auth.uid() during the query.
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
      auth: { persistSession: false },
    },
  );
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}
