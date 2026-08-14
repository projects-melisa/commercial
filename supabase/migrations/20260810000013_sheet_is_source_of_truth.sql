-- The Google Sheet becomes the source of truth, and the schema bends to it.
--
-- `Master_Database_Komersial_Compiled` has been rewritten by hand and no longer
-- resembles the workbook this schema was normalised from: different customers,
-- different contracts, a station per contract line, and several fields the database
-- has never had. Where the two disagree the Sheet wins, so the constraints that
-- encoded the workbook's shape are relaxed here rather than the Sheet being bent
-- back into them.
--
-- What the Sheet does NOT carry is left nullable rather than invented. Two fields
-- the application leans on — `Min_GPM_Target` and a service type — have no column in
-- the Sheet at all, and `Revenue_Data` still holds the old customer ids, so it cannot
-- supply the target either. A contract imported without a target reports "no target
-- set" and is excluded from below-target counts, exactly as a contract without a
-- volume reports no revenue rather than zero. Putting a number there would be making
-- one up.

-- ─── Customers ───────────────────────────────────────────────────────────────
-- The Sheet keys on CUST-001, not CUST-GH-001. The format check encoded the
-- workbook's two-letter business-line infix, which the Sheet does not use.
alter table customers drop constraint customers_id_format;
alter table customers add constraint customers_id_format check (customer_id ~ '^CUST-[A-Z0-9-]+$');

-- CRM_Data carries the three component scores behind the RFM standing.
alter table customers add column frequency_score smallint;
alter table customers add column monetary_score smallint;
alter table customers add column recency_score smallint;

-- ─── Contracts are no longer 1:1 with customers ──────────────────────────────
-- The Sheet has Garuda Indonesia twice (Ground Handling across all stations, and
-- Cargo at CGK and SUB) and Batik Air twice. A customer has as many contracts as
-- they have signed.
alter table contracts drop constraint contracts_customer_id_key;
create index contracts_customer_idx on contracts (customer_id);

-- What the Sheet carries that the database did not.
--
-- `contract_no` is the Sheet's ContractID (K-001). It is deliberately not unique:
-- K-010 appears twice, once for CGK and once for DPS, with a different tarif at
-- each — one contract, priced per station. That is also why a station stays a single
-- column: the Sheet already models multi-station work as one row per station, so
-- "MDC, BTH" is split on import rather than stored as a list.
alter table contracts add column contract_no text;
alter table contracts add column contract_start_date date;
alter table contracts add column pic_nama text;
alter table contracts add column pic_telepon text;
alter table contracts add column pic_email text;
alter table contracts add column remarks text;
alter table contracts add column latest_contract text;

create index contracts_contract_no_idx on contracts (contract_no);

-- ─── What the Sheet does not carry ───────────────────────────────────────────
-- `service_type` was mandatory because every workbook row had one. The Sheet has no
-- such column; `Remarks` (Airlines, FBO, GSE, Cargo, Joumpa, Learning Centre) reads
-- like a segment and is imported as itself rather than quietly renamed.
alter table contracts alter column service_type drop not null;

-- `source_end_date` existed to re-anchor the workbook's ageing dates on every seed.
-- The Sheet's dates are live and maintained by hand, so an imported row has no
-- "original" to preserve and carries null.
alter table contracts alter column source_end_date drop not null;

-- The margin target becomes optional, on the same rule as volume: absent means
-- unknown, never zero and never a house default.
alter table contracts alter column min_gpm_target drop not null;
alter table contracts drop constraint contracts_target_is_fraction;
alter table contracts add constraint contracts_target_is_fraction check (
  min_gpm_target is null or (min_gpm_target > 0 and min_gpm_target < 1)
);

-- ─── "All Station" means every station, not no station ───────────────────────
-- Migration 12 read a null `cabang` as portfolio-level work and hid it from every
-- branch. The Sheet settles the meaning the other way: "All Station" is a contract
-- worked at every airport — Garuda Indonesia's ground handling, DPR RI's Joumpa —
-- and the GM at each of them is responsible for it. Hiding it from all of them was
-- the mirror image of what the Sheet says.
--
-- Null therefore means "all of them" on both sides of the comparison now, which is
-- the same rule `business_line` has always followed.
create or replace function in_caller_scope(bl business_line, cb text) returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select (public.caller_sees_all_lines() or bl = public.caller_business_line())
     and (public.caller_cabang() is null or cb is null or cb = public.caller_cabang())
$$;

-- ─── Business line, named as the Sheet names it ──────────────────────────────
-- Renamed rather than added, so there is one cargo value and not two. Existing rows
-- follow the rename; nothing has to be updated.
alter type business_line rename value 'Cargo & Warehouse' to 'Cargo Handling';

-- ─── The scenario notification must survive a missing target ─────────────────
-- `to_char(null * 100, …)` yields null, which would silently produce "GPM 30.0%
-- terhadap target ." Say so plainly instead.
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
        'Skenario "%s" untuk %s diajukan oleh %s. GPM usulan %s%% terhadap target %s.',
        new.nama,
        coalesce(customer_nama, contract_row.customer_id),
        coalesce(author_nama, 'Commercial'),
        to_char(new.gpm * 100, 'FM990.0'),
        coalesce(to_char(contract_row.min_gpm_target * 100, 'FM990.0') || '%', 'yang belum ditetapkan')
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
