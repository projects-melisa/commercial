-- GM Cabang: Commercial's authority, one station's worth of it.
--
-- The third role. A GM Cabang does everything Commercial does — edits contracts,
-- authors scenarios, logs cases, creates customers — but sees only the contracts
-- belonging to their own airport. Scope is a second dimension alongside business
-- line, not a replacement for it, so the two compose: a profile carrying both a
-- line and a station is confined to the intersection.
--
-- The two dimensions are deliberately symmetrical. Null means "all of them" for
-- each, which is what already made one Commercial user cover three business lines;
-- a GM Cabang is that same user with a station filled in.

-- The new role. Nothing below references the literal 'cabang', because Postgres
-- refuses to use an enum value added in the transaction that added it — and because
-- the rule is genuinely "everyone who is not the monitoring role writes", not a list
-- of role names to keep in step with the enum.
alter type user_role add value if not exists 'cabang';

-- ─── Stations ────────────────────────────────────────────────────────────────
-- Reference data, and therefore here rather than in the generated seed: the seed is
-- the workbook, and the workbook has no stations. A new airport is an insert, not a
-- migration, which is why this is a table and not an enum.
create table cabang (
  kode text primary key,
  nama text not null,
  kota text not null,
  constraint cabang_kode_is_iata check (kode ~ '^[A-Z]{3}$')
);

insert into cabang (kode, nama, kota) values
  -- Sumatera
  ('BTJ', 'Sultan Iskandar Muda', 'Banda Aceh'),
  ('SBG', 'Maimun Saleh', 'Sabang'),
  ('LSW', 'Malikussaleh', 'Lhokseumawe'),
  ('MEQ', 'Cut Nyak Dhien', 'Meulaboh'),
  ('KNO', 'Kualanamu', 'Deli Serdang'),
  ('DTB', 'Silangit', 'Tapanuli Utara'),
  ('GNS', 'Binaka', 'Gunungsitoli'),
  ('FLZ', 'Ferdinand Lumban Tobing', 'Sibolga'),
  ('PDG', 'Minangkabau', 'Padang Pariaman'),
  ('PKU', 'Sultan Syarif Kasim II', 'Pekanbaru'),
  ('DUM', 'Pinang Kampai', 'Dumai'),
  ('BTH', 'Hang Nadim', 'Batam'),
  ('TNJ', 'Raja Haji Fisabilillah', 'Tanjungpinang'),
  ('NTX', 'Raden Sadjad', 'Natuna'),
  ('DJB', 'Sultan Thaha', 'Jambi'),
  ('PLM', 'Sultan Mahmud Badaruddin II', 'Palembang'),
  ('BKS', 'Fatmawati Soekarno', 'Bengkulu'),
  ('TKG', 'Radin Inten II', 'Lampung Selatan'),
  ('PGK', 'Depati Amir', 'Pangkalpinang'),
  ('TJQ', 'H.A.S. Hanandjoeddin', 'Belitung'),
  -- Jawa
  ('CGK', 'Soekarno-Hatta', 'Tangerang'),
  ('HLP', 'Halim Perdanakusuma', 'Jakarta'),
  ('BDO', 'Husein Sastranegara', 'Bandung'),
  ('KJT', 'Kertajati', 'Majalengka'),
  ('SRG', 'Jenderal Ahmad Yani', 'Semarang'),
  ('SOC', 'Adi Soemarmo', 'Boyolali'),
  ('CXP', 'Tunggul Wulung', 'Cilacap'),
  ('JOG', 'Adisutjipto', 'Sleman'),
  ('YIA', 'Yogyakarta International', 'Kulon Progo'),
  ('SUB', 'Juanda', 'Sidoarjo'),
  ('MLG', 'Abdulrachman Saleh', 'Malang'),
  ('BWX', 'Banyuwangi', 'Banyuwangi'),
  ('SUP', 'Trunojoyo', 'Sumenep'),
  -- Bali dan Nusa Tenggara
  ('DPS', 'I Gusti Ngurah Rai', 'Badung'),
  ('LOP', 'Zainuddin Abdul Madjid', 'Lombok Tengah'),
  ('BMU', 'Sultan Muhammad Salahuddin', 'Bima'),
  ('SWQ', 'Sultan Muhammad Kaharuddin III', 'Sumbawa'),
  ('KOE', 'El Tari', 'Kupang'),
  ('LBJ', 'Komodo', 'Manggarai Barat'),
  ('MOF', 'Frans Seda', 'Maumere'),
  ('RTG', 'Frans Sales Lega', 'Ruteng'),
  ('ENE', 'H. Hasan Aroeboesman', 'Ende'),
  ('TMC', 'Lede Kalumbang', 'Tambolaka'),
  ('WGP', 'Umbu Mehang Kunda', 'Waingapu'),
  ('ARD', 'Mali', 'Alor'),
  -- Kalimantan
  ('PNK', 'Supadio', 'Pontianak'),
  ('KTG', 'Rahadi Oesman', 'Ketapang'),
  ('PKY', 'Tjilik Riwut', 'Palangka Raya'),
  ('PKN', 'Iskandar', 'Pangkalan Bun'),
  ('SMQ', 'H. Asan', 'Sampit'),
  ('BDJ', 'Syamsudin Noor', 'Banjarbaru'),
  ('BPN', 'Sultan Aji Muhammad Sulaiman Sepinggan', 'Balikpapan'),
  ('AAP', 'Aji Pangeran Tumenggung Pranoto', 'Samarinda'),
  ('BEJ', 'Kalimarau', 'Berau'),
  ('TRK', 'Juwata', 'Tarakan'),
  ('NNX', 'Nunukan', 'Nunukan'),
  -- Sulawesi
  ('UPG', 'Sultan Hasanuddin', 'Maros'),
  ('TTR', 'Toraja', 'Tana Toraja'),
  ('MJU', 'Tampa Padang', 'Mamuju'),
  ('PLW', 'Mutiara SIS Al-Jufri', 'Palu'),
  ('LUW', 'Syukuran Aminuddin Amir', 'Luwuk'),
  ('KDI', 'Haluoleo', 'Kendari'),
  ('BUW', 'Betoambari', 'Baubau'),
  ('MDC', 'Sam Ratulangi', 'Manado'),
  ('GTO', 'Djalaluddin', 'Gorontalo'),
  -- Maluku dan Papua
  ('AMQ', 'Pattimura', 'Ambon'),
  ('TTE', 'Sultan Babullah', 'Ternate'),
  ('OTI', 'Pitu', 'Morotai'),
  ('DJJ', 'Dortheys Hiyo Eluay', 'Jayapura'),
  ('BIK', 'Frans Kaisiepo', 'Biak'),
  ('NBX', 'Douw Aturure', 'Nabire'),
  ('TIM', 'Mozes Kilangin', 'Mimika'),
  ('WMX', 'Wamena', 'Jayawijaya'),
  ('DEX', 'Nop Goliat', 'Yahukimo'),
  ('MKQ', 'Mopah', 'Merauke'),
  ('SOQ', 'Domine Eduard Osok', 'Sorong'),
  ('MKW', 'Rendani', 'Manokwari'),
  ('FKQ', 'Torea', 'Fakfak'),
  ('KNG', 'Kaimana', 'Kaimana');

-- Readable by anyone signed in: it is a list of airports, and the contract form has
-- to offer it. Nobody writes — stations are provisioned with the schema.
alter table cabang enable row level security;
create policy cabang_select_authenticated on cabang
  for select to authenticated
  using (true);

-- ─── The station on a contract, and on a profile ─────────────────────────────
-- Nullable, and not backfilled: a contract with no station is portfolio-level work
-- rather than a station's, and is invisible to a GM Cabang for exactly that reason.
-- Making it NOT NULL would also mean inventing a station for every row already in a
-- deployed database.
alter table contracts add column cabang text references cabang (kode);
alter table profiles add column cabang text references cabang (kode);

create index contracts_cabang_idx on contracts (cabang);

-- A VP is portfolio-wide and therefore unscoped on both dimensions.
--
-- ponytail: nothing forces a profile whose role is 'cabang' to actually carry a
-- station — such a profile would see everything, exactly as a Commercial profile
-- with a null business line already does. Provisioning is out of band and the seed
-- is generated, so the check would guard a path nobody walks. Add it here if
-- profiles ever become self-service.
alter table profiles drop constraint profiles_scope_matches_role;
alter table profiles add constraint profiles_scope_matches_role check (
  role <> 'vp' or (business_line is null and cabang is null)
);

-- ─── Scope, in one place ─────────────────────────────────────────────────────

/** The caller's station, or null when they are not confined to one. */
create function caller_cabang() returns text
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select cabang from public.profiles where id = (select auth.uid())
$$;

/**
 * Whether a row on `business_line` at `cabang` is within the caller's scope.
 *
 * Both dimensions, ANDed, each with null on the caller's side meaning "all of them".
 * Every policy below reads scope through here, so the two dimensions cannot drift
 * apart across a dozen policies — and a third dimension would be added once.
 *
 * Not security definer: it composes the definer helpers rather than reading profiles
 * itself, so it holds no privilege of its own.
 */
create function in_caller_scope(bl business_line, cb text) returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select (public.caller_sees_all_lines() or bl = public.caller_business_line())
     and (public.caller_cabang() is null or cb = public.caller_cabang())
$$;

/** Whether the caller is confined on neither dimension — a VP, or an unscoped Commercial. */
create function caller_sees_all_scopes() returns boolean
  language sql
  stable
  set search_path = ''
as $$
  select public.caller_sees_all_lines() and public.caller_cabang() is null
$$;

/**
 * Whether the caller may write at all.
 *
 * Stated as "not the monitoring role" rather than as a list of writing roles: VP is
 * the exception the system exists to enforce, and a fourth role that manages
 * contracts should not need this line edited to be able to.
 */
create function caller_may_write() returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = (select auth.uid())) <> 'vp',
    false
  )
$$;

revoke execute on function caller_cabang() from public, anon;
revoke execute on function in_caller_scope(business_line, text) from public, anon;
revoke execute on function caller_sees_all_scopes() from public, anon;
revoke execute on function caller_may_write() from public, anon;
grant execute on function caller_cabang() to authenticated;
grant execute on function in_caller_scope(business_line, text) to authenticated;
grant execute on function caller_sees_all_scopes() to authenticated;
grant execute on function caller_may_write() to authenticated;

-- ─── Policies, re-expressed through the two dimensions ───────────────────────
-- Every `caller_sees_all_lines() or business_line = caller_business_line()` becomes
-- `in_caller_scope(...)`. Leaving any one of them behind would let a GM Cabang read
-- the whole portfolio, because a station-scoped profile carries no business line and
-- so passes the line check on its own.

-- contracts ──────────────────────────────────────────────────────────────────
drop policy contracts_select_in_scope on contracts;
create policy contracts_select_in_scope on contracts
  for select to authenticated
  using (in_caller_scope(business_line, cabang));

drop policy contracts_update_in_scope on contracts;
create policy contracts_update_in_scope on contracts
  for update to authenticated
  using (caller_may_write() and in_caller_scope(business_line, cabang))
  with check (caller_may_write() and in_caller_scope(business_line, cabang));

drop policy contracts_insert_in_scope on contracts;
create policy contracts_insert_in_scope on contracts
  for insert to authenticated
  with check (caller_may_write() and in_caller_scope(business_line, cabang));

-- customers ──────────────────────────────────────────────────────────────────
-- A customer is visible exactly when their contract is. The unscoped short-circuit
-- is kept so a customer inserted just before its contract stays visible to the user
-- creating it.
drop policy customers_select_in_scope on customers;
create policy customers_select_in_scope on customers
  for select to authenticated
  using (
    caller_sees_all_scopes()
    or exists (
      select 1
      from contracts c
      where c.customer_id = customers.customer_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

drop policy customers_insert_commercial on customers;
create policy customers_insert_writer on customers
  for insert to authenticated
  with check (caller_may_write());

-- cases ──────────────────────────────────────────────────────────────────────
drop policy cases_select_in_scope on cases;
create policy cases_select_in_scope on cases
  for select to authenticated
  using (
    caller_sees_all_scopes()
    or exists (
      select 1
      from contracts c
      where c.customer_id = cases.customer_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

drop policy cases_insert_in_scope on cases;
create policy cases_insert_in_scope on cases
  for insert to authenticated
  with check (
    caller_may_write()
    and exists (
      select 1 from contracts c
      where c.customer_id = cases.customer_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

drop policy cases_update_in_scope on cases;
create policy cases_update_in_scope on cases
  for update to authenticated
  using (
    caller_may_write()
    and exists (
      select 1 from contracts c
      where c.customer_id = cases.customer_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  )
  with check (
    caller_may_write()
    and exists (
      select 1 from contracts c
      where c.customer_id = cases.customer_id
        and in_caller_scope(c.business_line, c.cabang)
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
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

drop policy scenarios_insert_own on scenarios;
create policy scenarios_insert_own on scenarios
  for insert to authenticated
  with check (
    caller_may_write()
    and author_id = (select auth.uid())
    and status in ('draft', 'pending')
    and exists (
      select 1
      from contracts c
      where c.id = scenarios.contract_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

drop policy scenarios_update_own_undecided on scenarios;
create policy scenarios_update_own_undecided on scenarios
  for update to authenticated
  using (
    caller_may_write()
    and author_id = (select auth.uid())
    and status in ('draft', 'pending')
  )
  with check (
    author_id = (select auth.uid())
    and status in ('draft', 'pending')
  );

drop policy scenarios_delete_own_draft on scenarios;
create policy scenarios_delete_own_draft on scenarios
  for delete to authenticated
  using (
    caller_may_write()
    and author_id = (select auth.uid())
    and status = 'draft'
  );

-- ─── Reminders ───────────────────────────────────────────────────────────────
-- Recipients now include the GM whose station the contract belongs to. A contract at
-- a station therefore notifies two people — the station's GM and the Commercial user
-- who covers everything — which is correct: both own the renewal. Idempotency keys on
-- the recipient, so neither gets it twice.
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
     and (p.cabang is null or p.cabang = c.cabang)
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
