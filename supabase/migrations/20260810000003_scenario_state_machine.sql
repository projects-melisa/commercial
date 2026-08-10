-- The scenario approval state machine.
--
--   draft ──submit──▶ pending ──approve──▶ approved   (terminal)
--                        │
--                        └────reject───▶ rejected     (terminal)
--
-- RLS decides *who* may act. This trigger decides *which transitions exist*, so an
-- authorised caller still cannot move a scenario somewhere the machine does not go.
-- Every transition writes a notification to the counterparty.

create function scenarios_enforce_transitions() returns trigger
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
    -- A pending scenario is awaiting a decision and is frozen until it gets one.
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

  -- The proposal itself is fixed at submission: a decision must be made against the
  -- figures that were put forward.
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
    -- Tell every VP there is something waiting on them.
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
    insert into public.notifications (recipient_id, severity, title, body, contract_id)
    values (
      new.author_id,
      'info',
      'Skenario disetujui',
      format(
        'Skenario "%s" untuk %s telah disetujui.',
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

create trigger scenarios_transitions
  before update on scenarios
  for each row
  execute function scenarios_enforce_transitions();

-- Keep contracts.updated_at honest so Settings can report when data last changed.
create function set_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contracts_set_updated_at
  before update on contracts
  for each row
  execute function set_updated_at();
