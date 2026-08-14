-- Reminders reach the branch for "All Station" work too.
--
-- Migration 13 taught the RLS policies that a null `contracts.cabang` is the Sheet's
-- "All Station" — a contract worked at every airport, visible at each of them. The
-- reminder function was left behind on the older reading, and its recipient join
-- still says:
--
--   and (p.cabang is null or p.cabang = c.cabang)
--
-- With `c.cabang` null that comparison is `'CGK' = null`, which is null, which is not
-- true. So a GM Cabang could open an All Station contract on screen, see it expiring,
-- and never receive the reminder for it — the one class of contract most likely to
-- matter, since six of the fifteen lines are All Station.
--
-- The fix is the same shape as `in_caller_scope`: null on either side means "all of
-- them". A Commercial user with no station still receives everything, and a GM Cabang
-- now receives their own station's contracts plus the portfolio-wide ones.
create or replace function send_expiry_reminders(target_contract_id uuid default null)
  returns setof reminder_outcome
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  result public.reminder_outcome;
  new_notification_id uuid;
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
      on p.role <> 'vp'
     and (p.business_line is null or p.business_line = c.business_line)
     and (p.cabang is null or c.cabang is null or p.cabang = c.cabang)
    where
      (c.contract_end_date - today) <= 60
      and (
        target_contract_id is null
        or (
          c.id = target_contract_id
          -- Re-impose the caller's scope: RLS does not apply inside a security
          -- definer function, so a caller must not reach a contract here that they
          -- could not have selected directly.
          and public.in_caller_scope(c.business_line, c.cabang)
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
