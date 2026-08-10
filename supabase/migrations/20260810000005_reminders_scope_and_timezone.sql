-- Three corrections to send_expiry_reminders.
--
-- 1. It was security definer, granted to `authenticated`, and applied no scope check
--    to `target_contract_id`. A Commercial user who could not select a row could
--    still pass its id here and get the customer name and days remaining back, and
--    write a notification into another line's inbox. Being security definer, it has
--    to re-impose by hand the scope that RLS would otherwise have imposed for it.
--
-- 2. The manual path skipped the `<= 60` filter but still computed a milestone,
--    falling through to 60 for a contract nowhere near expiry. That wrote an
--    `expiry-60` key, which the idempotency index then used to suppress the genuine
--    H-60 reminder for good.
--
-- 3. It read `current_date` — UTC on Supabase — while the application derives days
--    remaining in Asia/Jakarta. For seven hours a day the two disagreed, which is
--    precisely the badge-versus-email divergence the aligned milestones exist to
--    prevent.

create or replace function send_expiry_reminders(target_contract_id uuid default null)
  returns setof reminder_outcome
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  result public.reminder_outcome;
  new_notification_id uuid;
  -- The business's own date. Contracts carry dates, not timestamps, so "how many
  -- days left" has to be answered in Jakarta rather than in the server's timezone.
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  for result in
    select
      c.id,
      cu.nama,
      (c.contract_end_date - today)::integer as days_remaining,
      case
        when (c.contract_end_date - today) <= 14 then 14
        when (c.contract_end_date - today) <= 30 then 30
        else 60
      end as milestone,
      p.id,
      null::uuid
    from public.contracts c
    join public.customers cu on cu.customer_id = c.customer_id
    join public.profiles p
      on p.role = 'commercial'
     and p.business_line = c.business_line
    where
      -- A contract is only reminded once it has actually reached the widest
      -- milestone. This now holds for the manual path too, so triggering by hand
      -- cannot burn a milestone the contract has not reached.
      (c.contract_end_date - today) <= 60
      and (
        target_contract_id is null
        or (
          c.id = target_contract_id
          -- Re-impose the caller's scope: a VP may prompt anywhere, a Commercial
          -- user only within their own line, and anyone else not at all.
          and (
            public.caller_is_vp()
            or c.business_line = public.caller_business_line()
          )
        )
      )
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

    result.notification_id := new_notification_id;
    return next result;
  end loop;
end;
$$;
