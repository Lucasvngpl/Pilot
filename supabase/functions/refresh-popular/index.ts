/**
 * refresh-popular — Edge Function (scheduled / admin)
 *
 * POST /functions/v1/refresh-popular?batch=25&offset=0
 *
 * Refreshes a SLICE of the TMDb popular catalog into shows_cache.
 *
 * Why a slice (not all 200):
 *   Edge Function execution time caps at 150s (free tier) / 400s (pro).
 *   Refreshing 200 shows × ~10 seasons × 125ms throttle ≈ 250 seconds —
 *   we'd time out. So we batch: each invocation does ~25 shows in ~30s.
 *
 * Operating it:
 *   - Schedule the function via pg_cron to fire several times during a
 *     refresh window with incrementing offsets, OR
 *   - Trigger from an external scheduler (cron-job.org, GitHub Actions),
 *     OR
 *   - Invoke manually for testing:
 *       curl -X POST \
 *         'https://<ref>.supabase.co/functions/v1/refresh-popular?batch=10' \
 *         -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
 *
 * Response:
 *   { processed, ok, failed, offset, batch }
 *
 * Optional shared-secret gate:
 *   Set CRON_SECRET in function secrets and pass X-Cron-Secret on every
 *   invocation. Without CRON_SECRET set, this function relies on the
 *   default verify_jwt = true (so only callers with a valid JWT — incl.
 *   service_role — can hit it).
 */

import { corsHeaders } from '../_shared/cors.ts';
import { adminClient } from '../_shared/clients.ts';
import { fetchShowDetail, tmdbGet } from '../_shared/tmdb.ts';

const MAX_BATCH = 50;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Optional shared-secret gate. Enabled by `supabase secrets set CRON_SECRET=...`.
  const expectedSecret = Deno.env.get('CRON_SECRET');
  if (expectedSecret && req.headers.get('x-cron-secret') !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const batch = clampInt(url.searchParams.get('batch'), 25, 1, MAX_BATCH);
    const offset = clampInt(url.searchParams.get('offset'), 0, 0, 1000);

    const result = await refreshBatch(batch, offset);
    return json(result);
  } catch (err) {
    console.error('refresh-popular error:', err);
    return json({ error: err instanceof Error ? err.message : 'unknown' }, 500);
  }
});

// ----------------------------------------------------------------------------

type PopularPage = {
  page: number;
  total_pages: number;
  results: Array<{ id: number }>;
};

async function refreshBatch(batch: number, offset: number) {
  // /tv/popular returns 20 results per page. Translate (offset, batch) into
  // a starting page + a within-page skip, then walk pages until we've
  // collected `batch` IDs.
  const ids: number[] = [];
  let page = Math.floor(offset / 20) + 1;
  let skipInPage = offset % 20;

  while (ids.length < batch) {
    const data = await tmdbGet<PopularPage>('/tv/popular', { page: String(page) });
    for (let i = skipInPage; i < data.results.length; i++) {
      ids.push(data.results[i].id);
      if (ids.length >= batch) break;
    }
    if (page >= data.total_pages) break;
    page++;
    skipInPage = 0;
  }

  // Upsert each show with full detail.
  const admin = adminClient();
  let ok = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const payload = await fetchShowDetail(id);
      const { error } = await admin.from('shows_cache').upsert({
        tmdb_show_id: id,
        payload,
        is_popular: true,
        fetched_at: new Date().toISOString(),
      });
      if (error) {
        console.warn(`upsert ${id}:`, error.message);
        failed++;
      } else {
        ok++;
      }
    } catch (err) {
      console.warn(`refresh ${id}:`, err);
      failed++;
    }
  }

  return { processed: ids.length, ok, failed, offset, batch };
}

function clampInt(raw: string | null, dflt: number, min: number, max: number): number {
  const n = Number(raw ?? dflt);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(Math.floor(n), min), max);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
