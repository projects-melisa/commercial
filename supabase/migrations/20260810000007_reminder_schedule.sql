-- Repoint the daily schedule at the Edge Function, so the scheduled run sends email
-- as well as recording notifications.
--
-- Two jobs rather than one, deliberately:
--
--   1. `g-cme-daily-expiry-reminders` still calls send_expiry_reminders() directly.
--      Pure SQL, no network hop, so the notification rows are written even if the
--      Edge Function is undeployed or its SMTP credentials are wrong. The in-app
--      notification centre never depends on mail working.
--
--   2. `g-cme-daily-reminder-email` invokes the Edge Function a few minutes later,
--      which re-runs selection (idempotent, so it writes nothing new) and delivers
--      whatever is still owed an email, including anything an earlier failed run
--      left behind.
--
-- Configuration lives in Vault rather than inline, so the service-role key is not
-- sitting in a job definition readable by anyone who can select from cron.job.

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault cascade;

/**
 * Invokes the send-reminders Edge Function.
 *
 * Reads its endpoint and key from Vault. If either secret is absent the function
 * returns quietly instead of raising: an unconfigured environment should skip email,
 * not fail the scheduled run and leave a cron job in an error state.
 */
create function invoke_reminder_email() returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'functions_base_url';
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if base_url is null or service_key is null then
    raise notice 'reminder email skipped: functions_base_url or service_role_key not set in Vault';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

revoke execute on function invoke_reminder_email() from public, anon, authenticated;

select cron.schedule(
  'g-cme-daily-reminder-email',
  -- 00:20 UTC — 07:20 in Asia/Jakarta, five minutes after the rows are written.
  '20 0 * * *',
  $$select public.invoke_reminder_email()$$
);
