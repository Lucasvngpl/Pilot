# Pilot — Pre-Launch Security Audit

_2026-05-30. Verdict: **no CRITICAL/HIGH data-compromise issues.** Secrets boundary holds, RLS is sound. The real holes found are fixed below; the rest are accepted-risk decisions or one-time deployment actions._

## Fixed in this pass (in the repo — needs deploy/apply, see checklist)

- **RLS gap — `list_items` UPDATE had no `WITH CHECK`** (migration `0004`). Closed a hole where a user could `update` one of their list items to re-parent it into a list they don't own. Now the post-update row must also belong to a list the caller owns.
- **Scope-integrity CHECKs** (`0004`): an episode can't exist without a season on `watch_status` / `ratings` / `reviews` (blocks malformed rows that would corrupt the JS scope-merge).
- **Error-message leakage** — every Edge Function's 500 path returned the raw PostgREST/TMDb error string to the client (schema/upstream disclosure to anon callers). Now: log detail server-side, return a generic message. (`get-show`, `get-popular`, `get-reviews`, `search-shows`, `refresh-popular`.)
- **`refresh-popular` now fails closed** — requires `CRON_SECRET`. It was open if the secret was unset, and `verify_jwt` alone is insufficient because the public anon key is itself a valid JWT. This endpoint does expensive TMDb fan-out + privileged `shows_cache` writes, so it must not be anon-reachable.
- **`search-shows` query length capped** (200 chars).
- **Client**: removed the orphan "or" divider in the login sheet; reconfirmed only the anon key + project URL ship in the client bundle.

## MUST DO before launch (deployment — not code)

1. **Apply `supabase/migrations/0004_security_hardening.sql`** in the Supabase SQL editor.
2. **Redeploy the 5 Edge Functions** so the fixes go live:
   `supabase functions deploy get-show get-popular get-reviews search-shows refresh-popular` (one per command).
3. **Set the cron secret**: `supabase secrets set CRON_SECRET=<random-string>` and send it as `X-Cron-Secret` from whatever schedules `refresh-popular`. Without it, `refresh-popular` now rejects everything.
4. **Verify `verify_jwt`** in the Supabase dashboard matches intent: the public read functions are anonymous-safe by design; `refresh-popular`'s real gate is `CRON_SECRET` (not JWT).
5. **Pre-push**: `git status` shows no `.env` staged (currently none tracked — clean).

## Accepted risks / product decisions (v1)

- **`get-show` cold-cache TMDb fan-out** (MEDIUM). An anon caller requesting an *uncached* show id triggers 1 + N-season TMDb calls. Auth-gating cold refreshes would break anonymous browsing of uncached shows, so: **accept for v1, monitor TMDb quota**, add a per-IP throttle if abused.
- ~~**Default username = email local-part** (LOW).~~ **FIXED** — migration `0005` reseeds new signups with a random `user_<id8>` handle + null display name, and username editing is now enabled (`/settings`). Affects new signups only; existing email-derived handles stay until the user edits them.
- **CORS `*`** (LOW). Correct for token auth (no cookies/credentials).
- **No rate limiting** (v1, expected). The two amplification vectors were `refresh-popular` (now gated) and `get-show` cold fan-out (above).
- **`profiles` blanket UPDATE policy** (forward-looking). Safe today (only public columns). If a privileged column is ever added (`is_admin`, `is_verified`, `role`), gate it — the current policy authorizes updating *any* column on your own row.

## Verified strong (no action)

- **Secrets**: no keys/tokens in client code, bundle, logs, or git history; only `EXPO_PUBLIC_SUPABASE_URL` + the anon key are public (both safe by design); `.env` gitignored and never committed; the service-role key lives only in `scripts/.env` (untracked).
- **Client/server boundary**: zero direct TMDb data calls from the client; catalog only via Edge Functions; `image.tmdb.org` poster URLs are the only TMDb host touched client-side (expected).
- **RLS**: every table RLS-enabled with public-SELECT + write-own; `shows_cache` has no write policy (service-role only); `follows` blocks forged `follower_id` and self-follow; storage is own-folder only; the one `SECURITY DEFINER` function pins `search_path`.
- **Edge Function authZ**: identity always from the JWT (`auth.getUser`); no function trusts a body-supplied `user_id`; `adminClient()` (RLS-bypass) is used only to write `shows_cache`; no raw SQL / `.rpc` / string-built filters — all parameterized; TMDb URLs built via `URL`+`searchParams` (encoded).
- **Dependencies**: `npm audit` = 11 moderate, all in Expo *build* tooling (`@expo/prebuild-config`, `expo-splash-screen`), not runtime.

## Non-security polish noticed

- **"Forgot password?"** in the login sheet is inert (no reset flow) — a dead control. Wire `supabase.auth.resetPasswordForEmail(...)` or remove the link before launch.
