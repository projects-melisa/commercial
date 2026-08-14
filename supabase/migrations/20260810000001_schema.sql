-- Gapura Commercial schema, normalised from Master_Database_Komersial_Compiled.xlsx.
--
-- Revenue_Data duplicates tarif and cost from Compiled_Contracts; the duplication is
-- dropped on import and only Min_GPM_Target is carried across onto the contract row.
--
-- Derived and never stored: GPM as (tarif - cost) / tarif; days remaining from
-- contract_end_date; status band from days remaining; margin health as GPM against
-- min_gpm_target.

create type business_line as enum (
  'Ground Handling',
  'Cargo & Warehouse',
  'Ancillary Business'
);

create type user_role as enum ('vp', 'commercial');

create type rfm_status as enum ('HIGH', 'MEDIUM', 'LOW');

create type case_status as enum ('OPEN', 'CLOSED');

create type scenario_status as enum ('draft', 'pending', 'approved', 'rejected');

create type notification_severity as enum ('critical', 'warning', 'info');

-- One row per auth user. Role is never client-supplied: it is read from here by the
-- RLS policies, so a caller cannot grant themselves a scope they do not hold.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nama text not null,
  role user_role not null,
  business_line business_line,
  created_at timestamptz not null default now(),
  -- A VP is portfolio-wide and therefore unscoped; a Commercial user always has a line.
  constraint profiles_scope_matches_role check (
    (role = 'vp' and business_line is null)
    or (role = 'commercial' and business_line is not null)
  )
);

create table customers (
  customer_id text primary key,
  nama text not null,
  rfm_status rfm_status not null,
  constraint customers_id_format check (customer_id ~ '^CUST-[A-Z]{2}-[0-9]{3}$')
);

-- 1:1 with customers, as in the source workbook.
create table contracts (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null unique references customers (customer_id) on delete cascade,
  business_line business_line not null,
  service_type text not null,
  -- Seeded as an offset from import date so the renewal pipeline stays populated
  -- however long after import the demo is given.
  contract_end_date date not null,
  -- The workbook's original absolute date, retained so nothing is lost.
  source_end_date date not null,
  tarif numeric(18, 2) not null,
  cost numeric(18, 2) not null,
  min_gpm_target numeric(5, 4) not null,
  updated_at timestamptz not null default now(),
  constraint contracts_tarif_positive check (tarif > 0),
  constraint contracts_cost_non_negative check (cost >= 0),
  constraint contracts_cost_below_tarif check (cost < tarif),
  constraint contracts_target_is_fraction check (min_gpm_target > 0 and min_gpm_target < 1)
);

create index contracts_business_line_idx on contracts (business_line);
create index contracts_end_date_idx on contracts (contract_end_date);

-- Read-only reference data imported from CS_Data. No role owns case entry, so there
-- are deliberately no insert, update or delete policies for this table.
create table cases (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references customers (customer_id) on delete cascade,
  description text not null,
  status case_status not null
);

create index cases_customer_idx on cases (customer_id);

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  nama text not null,
  proposed_tarif numeric(18, 2) not null,
  proposed_cost numeric(18, 2) not null,
  -- Stored because it is the figure that was approved, not a live derivation.
  gpm numeric(6, 5) generated always as (
    (proposed_tarif - proposed_cost) / nullif(proposed_tarif, 0)
  ) stored,
  author_id uuid not null references profiles (id) on delete cascade,
  status scenario_status not null default 'draft',
  decided_by uuid references profiles (id),
  decided_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint scenarios_tarif_positive check (proposed_tarif > 0),
  constraint scenarios_cost_non_negative check (proposed_cost >= 0),
  -- A rejection must carry a reason; nothing else may.
  constraint scenarios_rejection_has_reason check (
    (status = 'rejected' and rejection_reason is not null and length(trim(rejection_reason)) > 0)
    or (status <> 'rejected' and rejection_reason is null)
  ),
  -- Decision metadata appears exactly when a decision has been made.
  constraint scenarios_decision_metadata check (
    (status in ('approved', 'rejected') and decided_by is not null and decided_at is not null)
    or (status in ('draft', 'pending') and decided_by is null and decided_at is null)
  )
);

create index scenarios_contract_idx on scenarios (contract_id);
create index scenarios_status_idx on scenarios (status);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles (id) on delete cascade,
  severity notification_severity not null,
  title text not null,
  body text not null,
  contract_id uuid references contracts (id) on delete cascade,
  read boolean not null default false,
  -- Idempotency for the reminder job: one notification per contract per milestone.
  milestone_key text,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, read);

create unique index notifications_milestone_idem_idx
  on notifications (recipient_id, contract_id, milestone_key)
  where milestone_key is not null;
