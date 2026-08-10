-- The Google Sheets mirror, refreshed on a schedule.
--
-- Until now the mirror was written only by hand (`pnpm sheets:sync`), which makes it
-- exactly the thing the spec says it must not be: a copy that goes quietly stale while
-- someone's pivot table keeps resolving against last month's figures.
--
-- Two halves, and the second is the point:
--
--   1. A daily pg_cron job posts to the app's /api/sheets/sync endpoint, which holds
--      the Google service-account credentials and does the writing. Not Vercel Cron,
--      for the same reasons the reminders are not: the Hobby plan allows one run a day
--      and fires anywhere within the scheduled hour, and running the scheduler in
--      Supabase also keeps a free project from auto-pausing.
--
--   2. Every run — scheduled or manual, succeeded or failed — records a row here. A
--      mirror nobody can see the freshness of is a mirror nobody can trust, so the
--      log is what turns "silently stale" into "visibly stale".

create type sheet_sync_status as enum ('ok', 'failed');

-- How the run was started, so a schedule that has stopped firing is distinguishable
-- from a mirror that is merely being kept alive by hand.
create type sheet_sync_trigger as enum ('schedule', 'manual');

create table sheet_syncs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  status sheet_sync_status not null,
  trigger sheet_sync_trigger not null,
  -- Data rows written across all four tabs, excluding the header rows.
  rows_written integer not null default 0,
  error text,
  -- A failure states why, and a success cannot claim a reason it does not have. The
  -- log is only worth reading if a green row means the sheet really was written.
  constraint sheet_syncs_failure_has_error check (
    (status = 'failed' and error is not null and length(trim(error)) > 0)
    or (status = 'ok' and error is null)
  ),
  constraint sheet_syncs_rows_non_negative check (rows_written >= 0)
);

create index sheet_syncs_finished_idx on sheet_syncs (finished_at desc);

alter table sheet_syncs enable row level security;

-- Readable by every signed-in user, deliberately unscoped by business line.
--
-- The table holds timestamps, counts and error text — no tarif, no cost, no customer.
-- Everyone who relies on the mirror needs to know whether it is current, and scoping
-- that by line would tell a Cargo user nothing about the sheet they actually open.
create policy sheet_syncs_select_authenticated on sheet_syncs
  for select to authenticated
  using (true);

-- No insert, update or delete policy. Rows are written by the sync endpoint under the
-- service role; a run record a user could forge or edit would report health that never
-- happened, which is worse than no log at all.

/**
 * Invokes the app's sheet-sync endpoint.
 *
 * Mirrors `invoke_reminder_email()`: configuration lives in Vault rather than inline,
 * so the shared secret is not sitting in a job definition readable by anyone who can
 * select from cron.job. If either secret is absent the function returns quietly — an
 * unconfigured environment should skip the mirror, not leave a cron job in an error
 * state.
 */
create function invoke_sheets_sync() returns void
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
    raise notice 'sheets mirror skipped: app_base_url or sheets_sync_secret not set in Vault';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/api/sheets/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sync_secret
    ),
    body := jsonb_build_object('trigger', 'schedule'),
    -- The mirror writes four tabs through the Sheets API; 30s is comfortable for 20
    -- contracts and still bounded if Google is slow.
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function invoke_sheets_sync() from public, anon, authenticated;

select cron.schedule(
  'g-cme-daily-sheets-mirror',
  -- 00:30 UTC — 07:30 in Asia/Jakarta, after the morning's reminder jobs have run.
  '30 0 * * *',
  $$select public.invoke_sheets_sync()$$
);
