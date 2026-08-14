-- Row-level security for Gapura Commercial.
--
-- Scoping is enforced here rather than in the interface: a Cargo & Warehouse user
-- querying for Ground Handling contracts gets nothing back, because those rows are
-- not visible to their session. Policies read the caller's role and business line
-- from their own profile, so scoping cannot be bypassed by a client-supplied
-- parameter.
--
-- Every table below has RLS enabled and no permissive default, so a table without a
-- matching policy returns nothing. An unauthenticated caller has no profile, both
-- helpers return null, every policy evaluates false, and all reads come back empty.

-- security definer so that reading the caller's own profile does not recurse through
-- the profiles policy. search_path is pinned to defeat search-path capture.
create function caller_role() returns user_role
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create function caller_business_line() returns business_line
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select business_line from public.profiles where id = (select auth.uid())
$$;

create function caller_is_vp() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())) = 'vp',
    false
  )
$$;

revoke execute on function caller_role() from public, anon;
revoke execute on function caller_business_line() from public, anon;
revoke execute on function caller_is_vp() from public, anon;
grant execute on function caller_role() to authenticated;
grant execute on function caller_business_line() to authenticated;
grant execute on function caller_is_vp() to authenticated;

alter table profiles enable row level security;
alter table customers enable row level security;
alter table contracts enable row level security;
alter table cases enable row level security;
alter table scenarios enable row level security;
alter table notifications enable row level security;

-- profiles ───────────────────────────────────────────────────────────────────
-- Names and roles are readable by any signed-in user so that scenario authorship
-- and approval decisions can be attributed. Commercial terms live elsewhere; this
-- table carries none. Nobody may write: profiles are provisioned out of band.
create policy profiles_select_authenticated on profiles
  for select to authenticated
  using (true);

-- contracts ──────────────────────────────────────────────────────────────────
create policy contracts_select_in_scope on contracts
  for select to authenticated
  using (caller_is_vp() or business_line = caller_business_line());

-- Commercial edits its own line and only its own line. The with-check clause
-- repeats the predicate so a row cannot be moved out of the caller's scope by the
-- same statement that updates it. There is deliberately no policy granting a VP
-- update: the monitoring role cannot alter commercial data.
create policy contracts_update_own_line on contracts
  for update to authenticated
  using (caller_role() = 'commercial' and business_line = caller_business_line())
  with check (caller_role() = 'commercial' and business_line = caller_business_line());

-- customers ──────────────────────────────────────────────────────────────────
-- A customer is visible exactly when their contract is.
create policy customers_select_in_scope on customers
  for select to authenticated
  using (
    caller_is_vp()
    or exists (
      select 1
      from contracts c
      where c.customer_id = customers.customer_id
        and c.business_line = caller_business_line()
    )
  );

-- cases ──────────────────────────────────────────────────────────────────────
-- Select only. CS_Data is imported read-only and no role owns case entry.
create policy cases_select_in_scope on cases
  for select to authenticated
  using (
    caller_is_vp()
    or exists (
      select 1
      from contracts c
      where c.customer_id = cases.customer_id
        and c.business_line = caller_business_line()
    )
  );

-- scenarios ──────────────────────────────────────────────────────────────────
create policy scenarios_select_in_scope on scenarios
  for select to authenticated
  using (
    exists (
      select 1
      from contracts c
      where c.id = scenarios.contract_id
        and (caller_is_vp() or c.business_line = caller_business_line())
    )
  );

-- Only a Commercial user may author, only against a contract in their own line,
-- and only in their own name.
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
        and c.business_line = caller_business_line()
    )
  );

-- The author may work on a scenario up to the point it is decided. Excluding the
-- terminal states from `using` is what makes an approved or rejected scenario
-- unchangeable: no update statement can select the row at all.
create policy scenarios_update_own_undecided on scenarios
  for update to authenticated
  using (
    caller_role() = 'commercial'
    and author_id = (select auth.uid())
    and status in ('draft', 'pending')
  )
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'pending')
  );

create policy scenarios_delete_own_draft on scenarios
  for delete to authenticated
  using (
    caller_role() = 'commercial'
    and author_id = (select auth.uid())
    and status = 'draft'
  );

-- Only a VP decides, only on a pending scenario, and only into a terminal state.
create policy scenarios_decide_vp on scenarios
  for update to authenticated
  using (caller_is_vp() and status = 'pending')
  with check (caller_is_vp() and status in ('approved', 'rejected'));

-- notifications ──────────────────────────────────────────────────────────────
create policy notifications_select_own on notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

-- Marking read is the only user-facing mutation; a trigger holds the update to the
-- `read` column alone. Rows are written by security-definer triggers and by the
-- reminder function under the service role, so there is no insert policy.
create policy notifications_update_own on notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create function notifications_only_read_flag_mutable() returns trigger
  language plpgsql
as $$
begin
  if (new.recipient_id, new.severity, new.title, new.body, new.contract_id, new.milestone_key, new.created_at)
     is distinct from
     (old.recipient_id, old.severity, old.title, old.body, old.contract_id, old.milestone_key, old.created_at)
  then
    raise exception 'only the read flag may be updated on a notification';
  end if;
  return new;
end;
$$;

create trigger notifications_guard_columns
  before update on notifications
  for each row
  execute function notifications_only_read_flag_mutable();
