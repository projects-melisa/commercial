-- One Commercial role covering every business line.
--
-- The demo is presented with two accounts, one per role, so the single Commercial user
-- has to be able to do for all three lines what three line-scoped users used to do for
-- one each. A Commercial profile may now carry a null `business_line`, which means
-- "every line" exactly as it already does for a VP.
--
-- The scoping machinery is deliberately kept rather than removed. The policies still
-- compare `business_line` against the caller's, so seeding a line-scoped Commercial
-- user restores per-line confinement without another migration — what has changed is
-- which accounts exist, not whether the database can express the boundary.
--
-- What this does cost, stated plainly: with no line-scoped account seeded, nothing in
-- the running demo demonstrates that one Commercial user cannot read another line's
-- tarif and cost. That was the system's headline property. It remains enforceable and
-- is still asserted against a fixture user in the RLS suite, but it is no longer what
-- the two demo logins show.

-- A VP is never line-scoped. A Commercial user may be scoped to one line, or unscoped
-- to mean all of them.
alter table profiles drop constraint profiles_scope_matches_role;
alter table profiles add constraint profiles_scope_matches_role check (
  role <> 'vp' or business_line is null
);

/**
 * Whether the caller sees every business line.
 *
 * True for a VP, and for a Commercial user with no line of their own. Requires a
 * profile row to exist, so a session without one — including any unauthenticated
 * caller — gets false rather than accidentally matching the null case.
 */
create function caller_sees_all_lines() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and business_line is null
  )
$$;

revoke execute on function caller_sees_all_lines() from public, anon;
grant execute on function caller_sees_all_lines() to authenticated;

-- contracts ──────────────────────────────────────────────────────────────────
drop policy contracts_select_in_scope on contracts;
create policy contracts_select_in_scope on contracts
  for select to authenticated
  using (caller_sees_all_lines() or business_line = caller_business_line());

-- Commercial still writes and a VP still cannot, but a Commercial user without a line
-- of their own may now write to any of them. The with-check clause repeats the
-- predicate so a row cannot be moved out of the caller's scope by the same statement
-- that updates it.
drop policy contracts_update_own_line on contracts;
create policy contracts_update_in_scope on contracts
  for update to authenticated
  using (
    caller_role() = 'commercial'
    and (caller_sees_all_lines() or business_line = caller_business_line())
  )
  with check (
    caller_role() = 'commercial'
    and (caller_sees_all_lines() or business_line = caller_business_line())
  );

-- customers ──────────────────────────────────────────────────────────────────
drop policy customers_select_in_scope on customers;
create policy customers_select_in_scope on customers
  for select to authenticated
  using (
    caller_sees_all_lines()
    or exists (
      select 1
      from contracts c
      where c.customer_id = customers.customer_id
        and c.business_line = caller_business_line()
    )
  );

-- cases ──────────────────────────────────────────────────────────────────────
drop policy cases_select_in_scope on cases;
create policy cases_select_in_scope on cases
  for select to authenticated
  using (
    caller_sees_all_lines()
    or exists (
      select 1
      from contracts c
      where c.customer_id = cases.customer_id
        and c.business_line = caller_business_line()
    )
  );

-- scenarios ──────────────────────────────────────────────────────────────────
drop policy scenarios_select_in_scope on scenarios;
create policy scenarios_select_in_scope on scenarios
  for select to authenticated
  using (
    exists (
      select 1
      from contracts c
      where c.id = scenarios.contract_id
        and (caller_sees_all_lines() or c.business_line = caller_business_line())
    )
  );

drop policy scenarios_insert_own on scenarios;
create policy scenarios_insert_own on scenarios
  for insert to authenticated
  with check (
    caller_role() = 'commercial'
    and author_id = (select auth.uid())
    and status in ('draft', 'pending')
    and exists (
      select 1
      from contracts c
      where c.id = scenarios.contract_id
        and (caller_sees_all_lines() or c.business_line = caller_business_line())
    )
  );

-- reminders ──────────────────────────────────────────────────────────────────
-- Recipients: the Commercial user who owns that line, or the one who owns them all.
-- Without this a contract in a line nobody is scoped to would select no recipient and
-- its reminder would never be written at all.
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
      on p.role = 'commercial'
     and (p.business_line is null or p.business_line = c.business_line)
    where
      (c.contract_end_date - today) <= 60
      and (
        target_contract_id is null
        or (
          c.id = target_contract_id
          -- Re-impose the caller's scope: RLS does not apply inside a security
          -- definer function, so a caller must not reach a contract here that they
          -- could not have selected directly.
          and (
            public.caller_sees_all_lines()
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
