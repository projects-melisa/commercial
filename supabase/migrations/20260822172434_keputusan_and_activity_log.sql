-- U-1, U-3 and the plumbing for U-6: decisions get recorded, actions get witnessed.
--
-- Three enum values first. Postgres refuses to read a value in the transaction that
-- added it, so the grant rows that USE these land in the next migration.

alter type app_module add value if not exists 'keputusan';
alter type app_module add value if not exists 'audit';
alter type grant_action add value if not exists 'export';

-- ─── U-1 · contract_decisions ────────────────────────────────────────────────
--
-- Requirement 1.0 asks to "mempercepat keputusan renew/no-renew"; today every ingredient
-- is on screen and the decision itself lives in WhatsApp. Append-only on purpose: a
-- decision that can be edited away was never recorded, it was only displayed.
create table contract_decisions (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id) on delete cascade,
  keputusan   text not null check (keputusan in ('renew', 'no_renew', 'renegosiasi')),
  alasan      text not null,
  skenario_id uuid references scenarios (id) on delete set null,
  oleh        uuid not null references profiles (id),
  pada        timestamptz not null default now()
);

create index contract_decisions_contract_idx on contract_decisions (contract_id);

-- Scope rides the contract, exactly as scenarios does: a caller sees a decision when
-- they may see the contract it belongs to.
drop policy if exists contract_decisions_select on contract_decisions;
create policy contract_decisions_select on contract_decisions
  for select to authenticated
  using (
    caller_may('keputusan', 'view')
    and exists (
      select 1 from contracts c
      where c.id = contract_decisions.contract_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

-- `input` (commercial) proposes-and-records; `approve` (vp) carries the same pen.
-- One insert policy for both, authorship pinned to the session so nobody signs
-- another person's name.
create policy contract_decisions_insert on contract_decisions
  for insert to authenticated
  with check (
    (caller_may('keputusan', 'input') or caller_may('keputusan', 'approve'))
    and oleh = (select auth.uid())
    and exists (
      select 1 from contracts c
      where c.id = contract_decisions.contract_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

-- Deliberately no update or delete policy. The ledger does not negotiate.

-- ─── U-3 / R-4 · activity_log ────────────────────────────────────────────────
--
-- "Hak akses diputus database" is a claim until something records who did what.
-- Written exclusively by triggers and by log_activity(); no table privilege of any
-- kind reaches an authenticated session, so nobody — super admin included — can
-- rewrite the past from the application.
create table activity_log (
  id     uuid primary key default gen_random_uuid(),
  pada   timestamptz not null default now(),
  aktor  uuid references profiles (id),
  aksi   text not null,
  detail jsonb not null default '{}'
);

create index activity_log_pada_idx on activity_log (pada desc);

create policy activity_log_select_auditors on activity_log
  for select to authenticated
  using (caller_may('audit', 'view'));

/**
 * The one sanctioned write path from a user session: exports call this with what they
 * exported, and the definer's rights bypass RLS on the way in. Everything else arrives
 * through the triggers below.
 */
create function log_activity(aksi text, detail jsonb default '{}') returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.activity_log (aktor, aksi, detail)
  values ((select auth.uid()), aksi, detail);
end;
$$;

revoke execute on function log_activity(text, jsonb) from public, anon;
grant  execute on function log_activity(text, jsonb) to authenticated;

-- Role changes: who made whom what, and when. R-4's whole ask.
create function audit_profile_role_change() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if old.role is distinct from new.role
     or old.business_line is distinct from new.business_line
     or old.cabang is distinct from new.cabang
  then
    insert into public.activity_log (aktor, aksi, detail)
    values (
      (select auth.uid()),
      'perubahan_pengguna',
      jsonb_build_object(
        'pengguna', new.id,
        'role_lama', old.role,
        'role_baru', new.role,
        'lini_lama', old.business_line,
        'lini_baru', new.business_line,
        'cabang_lama', old.cabang,
        'cabang_baru', new.cabang
      )
    );
  end if;
  return new;
end;
$$;

create trigger profiles_audit_role_change
  after update on profiles
  for each row execute function audit_profile_role_change();

-- Scenario decisions: the approval trail, which used to live nowhere.
create function audit_scenario_decision() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  if new.status <> old.status then
    insert into public.activity_log (aktor, aksi, detail)
    values (
      (select auth.uid()),
      format('skenario_%s', new.status),
      jsonb_build_object('skenario', new.id, 'kontrak', new.contract_id)
    );
  end if;
  return new;
end;
$$;

create trigger scenarios_audit_decision
  after update on scenarios
  for each row execute function audit_scenario_decision();

-- Pull runs: one row per tab lands here too, so "siapa memicu pull" includes the cron.
create function audit_sheet_sync() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.activity_log (aktor, aksi, detail)
  values (
    (select auth.uid()),
    'tarik_sheet',
    jsonb_build_object(
      'tab', new.tab,
      'status', new.status,
      'baris', new.rows_written,
      'pemicu', new.trigger
    )
  );
  return new;
end;
$$;

create trigger sheet_syncs_audit
  after insert on sheet_syncs
  for each row execute function audit_sheet_sync();

-- Both tables carry RLS like everything else. Without this the select policies above
-- are decoration: the ledger readable by anyone, the past rewritable.
alter table contract_decisions enable row level security;
alter table activity_log        enable row level security;
