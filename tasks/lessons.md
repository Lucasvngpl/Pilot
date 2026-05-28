# Lessons — Pilot

Self-improvement log. Each entry: a corrected pattern + the rule that prevents the same mistake. Read this at the start of any non-trivial session.

---

## RN can't reliably stack Modals — build sheets that open other sheets as overlays

iOS won't reliably present one `Modal` over another (the second silently fails to appear or doesn't receive touches). So a Modal-based bottom sheet **cannot** open a second sheet — e.g. a per-action auth gate (LoginSheet) launched from inside ShowActionSheet.

Real incident: anonymous user opened ShowActionSheet (Modal), tapped a rating star → `requireAuth` tried to present LoginSheet (Modal) on top → nothing happened, no sign-in prompt. Also the inner `<Pressable>` used to "absorb" scrim taps was intercepting the RatingPicker's drag responder, so stars wouldn't even fill.

**Rule:** any sheet that might open another surface (auth gate, nested picker, composer) must be a **positioned overlay** (`<View style={{position:'absolute', ...}}>` + RN `Animated` slide), NOT a `Modal`. Overlays stack by render order — a sheet mounted at root (after the routes) sits above any in-route sheet, and the underlying one stays mounted with state intact. Make scrim + sheet **siblings** (not parent/child) so a tap on the sheet doesn't bubble to the scrim — no responder hack needed, and child drags claim touches cleanly.

---

## Optimistic mutations sharing a queryKey must snapshot only their own slice

`useRate` and `useSetWatchStatus` both write to `['show', id]`. The naive optimistic pattern snapshots the whole `GetShowResponse` in `onMutate` and restores it in `onError`. If two such mutations overlap, the second's snapshot captures the first's optimistic write — so an error rollback restores the *other* mutation's in-flight state, corrupting the cache.

**Rule:** in `onMutate`, snapshot only the array/field your mutation touches (`prev.mySocial.ratings`, not the whole object). In `onError`, restore just that slice via a functional `setQueryData` updater. Concurrent mutations on the same key then can't clobber each other.

---

## Touch handlers can fire before onLayout sets dimensions — guard zero values

`RatingPicker.valueFromX` divides by `rowWidth`, which starts at 0 until `onLayout` fires. A tap during a sheet's slide-in animation (before layout settles) produced value 0 → committed `null` → **DELETEd the user's existing rating**.

**Rule:** any handler that reads a measured dimension must guard the unmeasured case. Here: ignore touches while `rowWidth <= 0`, and track an `interacted` ref so `onResponderRelease` only commits if a valid touch actually occurred during the gesture.

---

## When you write verification steps, prove the failure path actually fires

If a step says "do X to cause an error, watch the UI roll back," verify X actually triggers `onError` (or whatever you're asserting on). **Soft failures don't throw.**

Examples that *don't* work to test rollback in supabase-js:
- Revoking an INSERT RLS policy. PostgREST returns 201 with an empty body; the JS client does not throw; `onError` never fires; the optimistic update stays and the test falsely "passes."

Examples that *do* fire `onError`:
- Network errors (wifi off, point env var at a bad URL).
- 4xx with an error body (unique-constraint conflict, validation failure).
- 5xx (genuine server error).

**Rule:** before recommending a failure-injection test, write down which line of code raises and which handler catches it. If you can't name both, the test isn't a real test.

---

## Name files by the scope the implementation actually supports, not the abstraction

A hook called `useToggleWatched` *sounds* like it covers show / season / episode. If the implementation is binary delete-on-unwatch, that's episode-only — show/season need a 3-state cycle (`watchlist → watching → watched → none`) to preserve prior status.

Future-you (or another agent) will reach for the abstract-sounding hook on the wrong scope and reintroduce a status-loss bug.

**Rule:** name by what the code does today: `useToggleEpisodeWatched`. Same applies to components, contexts, screens, endpoints. If the name promises generality the implementation doesn't deliver, rename.

---

## Optimistic-update toggles need a per-key in-flight guard

A toggle mutation with optimistic UI has a race:

1. Tap → `onMutate` flips the cache → request in flight.
2. Tap again (cache already shows the new state) → `onMutate` flips back → opposite request fires.
3. Both requests complete → wrong final state, phantom row, or constraint conflict.

`useMutation`'s `isPending` is hook-instance-wide, not per-key, so it can't disambiguate "this same toggle is in flight" from "any toggle is in flight."

**Rule:** for any toggle mutation with optimistic updates, keep a module-scope `Set<string>` keyed by the mutation arguments. Dedupe at the top of the public `toggle()` wrapper, *before* the optimistic update fires. Per-key so independent rows can toggle concurrently.

---

## Invalidate the query cache on auth state changes

User-scoped data (`mySocial`, "my reviews", etc.) cached during one identity is wrong under another. After sign-in or sign-out, the React Query cache still holds the previous identity's view → a mutation reading that cache will pick the wrong branch (e.g. "this episode is unwatched, INSERT a row" when the DB already has the row → `23505 duplicate key`).

**Rule:** in the Supabase `onAuthStateChange` listener, call `queryClient.invalidateQueries()` on `SIGNED_IN` / `SIGNED_OUT`. Skip `TOKEN_REFRESHED` — same identity, no need.

Defense in depth: also make mutations idempotent where possible — `UPSERT` instead of `INSERT`, composite-key `DELETE` instead of by-id — so they survive cache desync gracefully even if the invalidation slips.

---

## Don't read the cache inside mutationFn — it's already been optimistically mutated

`onMutate` runs **before** `mutationFn`. So by the time `mutationFn` re-reads `queryClient.getQueryData(...)`, the cache shows the *post-mutation* state, not the original. A hook that branches on the cached state from inside `mutationFn` will pick the wrong branch.

Real incident: `useToggleEpisodeWatched` v1 read the cache to decide insert-vs-delete. First tap on an unwatched episode → `onMutate` inserted a placeholder row with id `optimistic-{timestamp}` → `mutationFn` read the cache, saw a row, decided "delete", fired `DELETE WHERE id = 'optimistic-...'` → Postgres 22P02 ("invalid uuid"). The optimistic check appeared then reverted; the bug looked like a network/RLS issue.

**Rule:** the *pre-mutation* state is the caller's knowledge, not the hook's. Pass it in as an arg (`currentlyWatched: boolean`). `mutationFn` branches on the arg, not on the cache.

Related: don't `delete().eq('id', cachedRow.id)` if the cached row could be an optimistic placeholder. For tables with a composite unique key (like ours), prefer composite-key delete — `eq('user_id', ...).eq('tmdb_show_id', ...).eq('season_number', ...).eq('episode_number', ...)` — which doesn't depend on knowing the real row id.

---

## Always check whether mockups are accessible before building UI

When a build plan references external visual resources (Figma, screenshots, design system files) and those resources aren't reachable in the current session, **stop before building any UI** and surface the gap. Don't silently interpret text descriptions as a substitute.

Real incident: built the Home and Show Detail screens from text sketches ("two poster shelves + FAB") because the Figma MCP wasn't wired up. User discovered the gap when they asked directly. Wasted Phase E work and eroded trust.

**Rule:** before any "match the design" task, verify the source is reachable. Check MCP, check repo for keys/links, check chat for shared images. If none present, ask which format works (MCP setup, PNG drops, view-only link). Resume only when you can match the design, not interpret it.
