-- The renewal process, end to end: apply what was approved, remember what was done.

-- 1 ── An approved scenario becomes the contract's price.
--
-- Done in the existing transition trigger rather than in a server action: it is
-- already security definer, which is what makes this possible at all — a VP holds no
-- update policy on contracts, so the write has to happen somewhere RLS does not apply.
-- Approving and applying are then the same transaction and cannot disagree.
create or replace function scenarios_enforce_transitions() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  contract_row public.contracts%rowtype;
  customer_nama text;
  author_nama text;
begin
  if old.status = new.status then
    if old.status = 'pending' then
      raise exception 'a pending scenario cannot be edited; it awaits a decision';
    end if;
    return new;
  end if;

  if not (
    (old.status = 'draft' and new.status = 'pending')
    or (old.status = 'pending' and new.status in ('approved', 'rejected'))
  ) then
    raise exception 'invalid scenario transition: % -> %', old.status, new.status;
  end if;

  if old.status = 'pending' and (
    new.proposed_tarif is distinct from old.proposed_tarif
    or new.proposed_cost is distinct from old.proposed_cost
    or new.contract_id is distinct from old.contract_id
    or new.nama is distinct from old.nama
  ) then
    raise exception 'a scenario under decision cannot have its figures changed';
  end if;

  select * into contract_row from public.contracts where id = new.contract_id;
  select nama into customer_nama from public.customers where customer_id = contract_row.customer_id;
  select nama into author_nama from public.profiles where id = new.author_id;

  if new.status = 'pending' then
    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    select
      p.id,
      'info',
      'Skenario menunggu persetujuan',
      format(
        'Skenario "%s" untuk %s diajukan oleh %s. GPM usulan %s%% terhadap target %s%%.',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id),
        coalesce(author_nama, 'Commercial'),
        to_char(new.gpm * 100, 'FM990.0'),
        to_char(contract_row.min_gpm_target * 100, 'FM990.0')
      ),
      new.contract_id
    from public.profiles p
    where p.role = 'vp';

  elsif new.status = 'approved' then
    -- ponytail: contracts_cost_below_tarif refuses a scenario whose cost exceeds its
    -- tarif, so an unapplicable proposal fails the approval rather than silently
    -- landing. Blocking such a scenario at submission would be the nicer error.
    update public.contracts
      set tarif = new.proposed_tarif,
          cost = new.proposed_cost
      where id = new.contract_id;

    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    values (
      new.author_id,
      'info',
      'Skenario disetujui',
      format(
        'Skenario "%s" untuk %s disetujui dan sudah diterapkan ke kontrak.',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id)
      ),
      new.contract_id
    );

  elsif new.status = 'rejected' then
    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    values (
      new.author_id,
      'warning',
      'Skenario ditolak',
      format(
        'Skenario "%s" untuk %s ditolak. Alasan: %s',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id),
        new.rejection_reason
      ),
      new.contract_id
    );
  end if;

  return new;
end;
$$;

-- 2 ── Renewal, and 3 ── the follow-up the critical queue forgets.
alter table contracts add column previous_end_date date;
alter table contracts add column followed_up_at timestamptz;

-- Moving the end date *is* the renewal, so the previous term is captured by the same
-- trigger that already stamps updated_at. No renewal action, no renewal table: the
-- edit form is the renewal path and this makes it leave a trace.
create or replace function set_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  if new.contract_end_date is distinct from old.contract_end_date then
    new.previous_end_date = old.contract_end_date;
    -- A renewed contract is a fresh problem; whatever chasing was done is spent.
    new.followed_up_at = null;
  end if;
  return new;
end;
$$;

-- 4 ── Contracts and customers can be created. Commercial only; a VP still writes
-- nothing. Customers carry no business line of their own, so their gate is the role.
create policy customers_insert_commercial on customers
  for insert to authenticated
  with check (caller_role() = 'commercial');

create policy contracts_insert_in_scope on contracts
  for insert to authenticated
  with check (
    caller_role() = 'commercial'
    and (caller_sees_all_lines() or business_line = caller_business_line())
  );

-- 5 ── Service cases become writable. They were read-only because no role owned case
-- entry; Commercial owns it now. Delete is still nobody's: a case that happened
-- happened, and closing it is what "done" means.
create policy cases_insert_in_scope on cases
  for insert to authenticated
  with check (
    caller_role() = 'commercial'
    and exists (
      select 1 from contracts c
      where c.customer_id = cases.customer_id
        and (caller_sees_all_lines() or c.business_line = caller_business_line())
    )
  );

create policy cases_update_in_scope on cases
  for update to authenticated
  using (
    caller_role() = 'commercial'
    and exists (
      select 1 from contracts c
      where c.customer_id = cases.customer_id
        and (caller_sees_all_lines() or c.business_line = caller_business_line())
    )
  )
  with check (
    caller_role() = 'commercial'
    and exists (
      select 1 from contracts c
      where c.customer_id = cases.customer_id
        and (caller_sees_all_lines() or c.business_line = caller_business_line())
    )
  );
