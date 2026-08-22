-- U-8 · access with an expiry, and delegation between people.
-- U-9 · the HUB level the decomposition tree skipped over.
--
-- Both are access-model changes, so both land on the same two helpers rather than
-- on thirty policies: an expired account fails every grant inside `caller_may`, and
-- a regional view appears inside `in_caller_scope`. Nothing else moves.

-- ─── U-8 ─────────────────────────────────────────────────────────────────────

alter table profiles add column berlaku_sampai date;

comment on column profiles.berlaku_sampai is
  'Last day the account may act. Null means indefinitely. An expired account fails
   every grant in caller_may — centrally, not policy by policy.';

create table role_delegations (
  id    uuid primary key default gen_random_uuid(),
  dari  uuid not null references profiles (id) on delete cascade,
  ke    uuid not null references profiles (id) on delete cascade,
  mulai date not null default current_date,
  sampai date,
  constraint role_delegations_not_self check (dari <> ke),
  constraint role_delegations_window_sane check (sampai is null or sampai >= mulai)
);

comment on table role_delegations is
  'A live row lends the DELEGATOR''s role grants to `ke` for the window. Scope is
   never lent: the caller''s own cabang / business line / hub still bound every query.
   Provisioned by SQL for now — no screen writes this table.';

alter table role_delegations enable row level security;

create policy role_delegations_select_parties on role_delegations
  for select to authenticated
  using (
    dari = (select auth.uid())
    or ke = (select auth.uid())
    or caller_may('pengguna', 'manage')
  );

/**
 * Grants, now gated three ways: the account is unexpired, its role holds the grant,
 * or someone else's role does through a live delegation to this account.
 */
create or replace function caller_may(m app_module, a grant_action) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  with me as (
    select * from public.profiles where id = (select auth.uid())
  ),
  today as (
    select (now() at time zone 'Asia/Jakarta')::date as hari
  )
  select
    coalesce(
      (select berlaku_sampai is null or berlaku_sampai >= hari from me, today),
      false
    )
    and (
      exists (
        select 1
        from public.role_module_grants g
        where g.modul = m and g.aksi = a
          and g.role = (select role from me)
      )
      or exists (
        select 1
        from public.role_delegations d
        join public.profiles p on p.id = d.dari
        join public.role_module_grants g
          on g.role = p.role and g.modul = m and g.aksi = a
        cross join today
        where d.ke = (select auth.uid())
          and d.mulai <= hari
          and (d.sampai is null or d.sampai >= hari)
      )
    )
$$;

revoke execute on function caller_may(app_module, grant_action) from public, anon;
grant  execute on function caller_may(app_module, grant_action) to authenticated;

-- ─── U-9 ─────────────────────────────────────────────────────────────────────

alter table cabang add column hub text;

comment on column cabang.hub is
  'The hub this station reports to (C-19). The client''s tracker names five — CGK,
   DPS, SUB, KNO, UPG — and those carry themselves as their own hub until the client
   maps the rest. Null means unmapped.';

update cabang set hub = kode
where kode in ('CGK', 'DPS', 'SUB', 'KNO', 'UPG');

-- A profile points at one hub, so hubs need an identity to point at. Nulls are
-- unmapped stations; Postgres lets those repeat.
alter table cabang add constraint cabang_hub_key unique (hub);

alter table profiles add column hub text references cabang (hub);

comment on column profiles.hub is
  'The hub a regional profile covers. Set only on profiles whose cabang is null —
   the same convention as every other axis: null means "all of them".';

/** The caller's hub, or null when they are not confined to one. */
create function caller_hub() returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select hub from public.profiles where id = (select auth.uid())
$$;

revoke execute on function caller_hub() from public, anon;
grant  execute on function caller_hub() to authenticated;

/**
 * The third dimension lands here once, and every existing policy inherits it —
 * which is why it lives in this function and nowhere else.
 *
 * A profile with a hub and no station sees exactly the mapped stations under that
 * hub. Portfolio-wide rows (`cabang is null`, the Sheet's All Station) stay outside:
 * regional work is station work at several airports, not the whole book.
 */
create or replace function in_caller_scope(bl business_line, cb text) returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select (public.caller_sees_all_lines() or bl = public.caller_business_line())
     and (public.caller_cabang() is null or cb = public.caller_cabang())
     and (
       public.caller_hub() is null
       or exists (
         select 1 from public.cabang b
         where b.kode = cb and b.hub = public.caller_hub()
       )
     )
$$;
