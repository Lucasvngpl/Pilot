-- 0006 — schedule refresh-popular daily (pg_cron + pg_net)
--
-- Applied MANUALLY via the Supabase SQL editor. Keeps the "Popular on TV" shelf
-- (shows_cache.is_popular) fresh — without this it's a one-time seed-day snapshot.
--
-- ┌─ PREREQUISITES (do these FIRST — none of them belong in this committed file) ─┐
-- │ 1. Function secret so refresh-popular's fail-closed gate passes:              │
-- │      supabase secrets set CRON_SECRET=<a-random-32+char-string>               │
-- │ 2. The SAME value in Vault so this cron can send it as a header — run once    │
-- │    in the SQL editor with the REAL value (do NOT commit it):                  │
-- │      select vault.create_secret('<same-value>', 'cron_secret');               │
-- │ 3. Deploy WITH verify_jwt OFF (the cron sends only X-Cron-Secret, no          │
-- │    Authorization — with verify_jwt on, the gateway 401s before the function): │
-- │      supabase functions deploy refresh-popular --no-verify-jwt                 │
-- └──────────────────────────────────────────────────────────────────────────────┘
-- The function secret (1) and the Vault secret (2) MUST be identical — the cron
-- sends (2) as X-Cron-Secret, the function compares it to (1).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Re-runnable: drop the job if it already exists, then (re)create it.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'refresh-popular-daily') then
    perform cron.unschedule('refresh-popular-daily');
  end if;
end $$;

-- Daily at 08:00 UTC. Refreshes the top 25 (the visible shelf is the first ~8);
-- to cover more of the catalog, add jobs at offset 25, 50, … on a staggered
-- minute. The X-Cron-Secret is read from Vault so the value never lives in SQL.
select cron.schedule(
  'refresh-popular-daily',
  '0 8 * * *',
  $job$
  select net.http_post(
    url := 'https://hhpczdqpfbcoamayrbtx.supabase.co/functions/v1/refresh-popular?batch=25&offset=0',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $job$
);

-- Verify after applying:
--   select jobname, schedule, active from cron.job;
--   select status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 5;
