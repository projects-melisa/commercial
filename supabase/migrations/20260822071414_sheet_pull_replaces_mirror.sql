-- The Sheet becomes the only source, and the pull becomes the only direction.
--
-- Until now the schedule wrote Supabase *over* the Google Sheet. That mirror cleared
-- each tab before writing, so a run against a stale database would have replaced the
-- client's hand-maintained workbook with an older copy. It was unscheduled months ago
-- for exactly that reason, which left the endpoint sitting there still able to fire.
-- Here it is removed, and the opposite direction is scheduled in its place.
--
-- Three things this needs from the schema:
--
--   1. Natural keys, so the pull can upsert. `pnpm seed:generate` deletes before it
--      inserts, which is correct for a seed and ruinous on a schedule: one tab
--      emptied by a mis-click would take the production rows with it.
--   2. A `tab` column on the log, because the pull fails per tab rather than per run.
--      A row saying "the run failed" cannot distinguish a broken Ancillary header from
--      a Google outage that stopped everything.
--   3. The mirror's invoker gone, not merely unscheduled.

-- ── 1. Natural keys ─────────────────────────────────────────────────────────────
--
-- `nulls not distinct` in every case, because null is a value here rather than an
-- unknown: a contract with `cabang = null` is the Sheet's "All Station", one specific
-- row, and two of them are a duplicate. Under the default `nulls distinct` the pull
-- would insert a fresh All-Station copy of K-001 every single night.

alter table contracts
  add constraint contracts_sheet_key unique nulls not distinct (contract_no, cabang);

alter table cases
  add constraint cases_sheet_key unique nulls not distinct (customer_id, description);

alter table ancillary_revenues
  add constraint ancillary_revenues_sheet_key
  unique nulls not distinct (cab, plan_actual, customer, periode, group_1_gl);

-- ── 2. Per-tab logging ──────────────────────────────────────────────────────────
--
-- Nullable, because the rows the mirror already wrote belong to no tab and inventing
-- one for them would be a lie in the log the log exists to prevent.
alter table sheet_syncs add column tab text;

comment on column sheet_syncs.tab is
  'Which Master tab this run covered. Null on rows written by the removed mirror.';

-- ── 3. The mirror, removed ──────────────────────────────────────────────────────

do $$
begin
  if exists (select 1 from cron.job where jobname = 'g-cme-daily-sheets-mirror') then
    perform cron.unschedule('g-cme-daily-sheets-mirror');
  end if;
end;
$$;

drop function if exists public.invoke_sheets_sync();

-- ── 4. The pull, scheduled ──────────────────────────────────────────────────────

/**
 * Invokes the app's sheet-pull endpoint.
 *
 * Mirrors `invoke_reminder_email()`: configuration lives in Vault rather than inline,
 * so the shared secret is not sitting in a job definition readable by anyone who can
 * select from cron.job. If either secret is absent the function returns quietly — an
 * unconfigured environment should skip the pull, not leave a cron job in an error
 * state.
 */
create function invoke_sheets_pull() returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  base_url text;
  sync_secret text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into sync_secret
    from vault.decrypted_secrets where name = 'sheets_sync_secret';

  if base_url is null or sync_secret is null then
    raise notice 'sheets pull skipped: app_base_url or sheets_sync_secret not set in Vault';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/api/sheets/pull',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sync_secret
    ),
    body := jsonb_build_object('trigger', 'schedule'),
    -- Reads five ranges from Google and upserts each: more work than the mirror's
    -- single batch write, so the bound is looser while still being a bound.
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function invoke_sheets_pull() from public, anon, authenticated;

select cron.schedule(
  'g-cme-daily-sheets-pull',
  -- 19:00 UTC — 02:00 the next day in Asia/Jakarta, as the spec asks. Ahead of the
  -- 00:15 reminder job, so the reminders read the day's freshly pulled end dates.
  '0 19 * * *',
  $$select public.invoke_sheets_pull()$$
);

notify pgrst, 'reload schema';
