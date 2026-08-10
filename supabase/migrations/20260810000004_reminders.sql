-- Expiry reminders at 60, 30 and 14 days.
--
-- Selection lives here, in one function, because the daily job and the manual
-- "Kirim Reminder Sekarang" control both call it. A demo path that picked contracts
-- differently from the scheduled path would prove nothing about the scheduled path.
--
-- The milestones are the same numbers the status bands are built from, so a badge and
-- an email can never disagree about the same contract.
--
-- A contract is reminded for the tightest milestone it has reached but not yet been
-- reminded for. "Reached" rather than "landed exactly on": a contract at 29 days has
-- passed the 30-day mark, and selecting only exact matches would drop it for good if
-- the job missed a day — which on a free project that pauses is not hypothetical.
-- Firing at most once per milestone is what the idempotency key guarantees.

create type reminder_outcome as (
  contract_id uuid,
  customer_nama text,
  days_remaining integer,
  milestone integer,
  recipient_id uuid,
  notification_id uuid
);

create function send_expiry_reminders(target_contract_id uuid default null)
  returns setof reminder_outcome
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  result public.reminder_outcome;
  new_notification_id uuid;
begin
  for result in
    select
      c.id,
      cu.nama,
      (c.contract_end_date - current_date)::integer as days_remaining,
      -- The tightest milestone this contract has reached. Past the end date it is
      -- still 14: expiry is the most urgent thing that can be said about it.
      case
        when (c.contract_end_date - current_date) <= 14 then 14
        when (c.contract_end_date - current_date) <= 30 then 30
        else 60
      end as milestone,
      p.id,
      null::uuid
    from public.contracts c
    join public.customers cu on cu.customer_id = c.customer_id
    -- Reminders go to the Commercial user who owns that business line, and to
    -- nobody else: a VP is not the person who acts on a renewal.
    join public.profiles p
      on p.role = 'commercial'
     and p.business_line = c.business_line
    where
      case
        when target_contract_id is not null then c.id = target_contract_id
        -- Scheduled: anything that has reached the widest milestone.
        else (c.contract_end_date - current_date) <= 60
      end
  loop
    insert into public.notifications (
      recipient_id, severity, title, body, contract_id, milestone_key
    )
    values (
      result.recipient_id,
      (case
        when result.days_remaining <= 14 then 'critical'
        when result.days_remaining <= 30 then 'warning'
        else 'info'
      end)::public.notification_severity,
      case
        when result.days_remaining < 0
          then format('Kontrak %s sudah lewat tempo', result.customer_nama)
        when result.days_remaining = 0
          then format('Kontrak %s berakhir hari ini', result.customer_nama)
        else format('Kontrak %s H-%s', result.customer_nama, result.days_remaining)
      end,
      case
        when result.days_remaining < 0 then format(
          'Kontrak %s telah melewati tanggal berakhir %s hari lalu. Segera konfirmasi status perpanjangan.',
          result.customer_nama, abs(result.days_remaining))
        else format(
          'Kontrak %s akan berakhir dalam %s hari. Siapkan posisi renegosiasi sekarang.',
          result.customer_nama, result.days_remaining)
      end,
      result.contract_id,
      format('expiry-%s', result.milestone)
    )
    on conflict (recipient_id, contract_id, milestone_key) where milestone_key is not null
    do nothing
    returning id into new_notification_id;

    -- Null when this milestone had already been sent, which is how the caller
    -- distinguishes "sent" from "already sent".
    result.notification_id := new_notification_id;
    return next result;
  end loop;
end;
$$;

revoke execute on function send_expiry_reminders(uuid) from public, anon;
grant execute on function send_expiry_reminders(uuid) to authenticated, service_role;

-- The daily schedule. pg_cron runs inside the database, which also keeps a free
-- Supabase project from auto-pausing — Vercel's Hobby cron allows one run a day and
-- fires anywhere within the scheduled hour, which is too loose for a date boundary.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'g-cme-daily-expiry-reminders',
  -- 00:15 UTC is 07:15 in Asia/Jakarta, so the run lands early in the working day.
  '15 0 * * *',
  $$select public.send_expiry_reminders()$$
);
