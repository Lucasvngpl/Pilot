// Shared CORS headers for all Edge Functions.
//
// Why every function needs this:
//   Browsers send a "preflight" OPTIONS request before any non-trivial
//   cross-origin call (anything with custom headers like `Authorization`).
//   The preflight must respond 200 with the right `Access-Control-Allow-*`
//   headers, or the browser blocks the actual request.
//
// On a phone (native Expo) there's no CORS check, but during dev (Expo Web,
// curl from a browser tab, the Supabase dashboard's "Test" button) you will
// hit this path.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
