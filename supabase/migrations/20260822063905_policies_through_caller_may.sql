-- Setiap kebijakan dibaca lewat caller_may, dan caller_may_write dibuang.
--
-- caller_may_write() berbunyi "bukan vp". Itu benar ketika hanya ada tiga role dan
-- VP satu-satunya pengecualian. Dengan sembilan role ia menjadi berbahaya: direktur
-- utama, super admin, dan keempat unit KPS semuanya lolos, dan tidak ada yang gagal
-- untuk memberitahu. Sebuah predikat yang melebar diam-diam saat enum bertambah
-- adalah persis jenis kesalahan yang tabel grant dibuat untuk mencegah.

-- ─── contracts ───────────────────────────────────────────────────────────────
-- Sheet adalah sumber kebenaran, jadi tidak ada jalan tulis dari aplikasi sama
-- sekali. Kebijakan insert dan update dihapus, bukan diperketat: kebijakan yang
-- ada tapi tak pernah lolos hanya mengundang orang berikutnya melonggarkannya.
drop policy if exists contracts_insert_in_scope on contracts;
drop policy if exists contracts_update_in_scope on contracts;

drop policy if exists contracts_select_in_scope on contracts;
create policy contracts_select_in_scope on contracts
  for select to authenticated
  using (caller_may('kontrak', 'view') and in_caller_scope(business_line, cabang));

-- ─── cases (Irregularities) ──────────────────────────────────────────────────
-- OCS saja, membaca maupun menulis. Scope turunan lewat kontrak dilepas: ia dulu
-- ada untuk membatasi GM Cabang, dan cabang kini tidak memegang modul ini sama
-- sekali, sehingga satu-satunya yang dilakukan subquery itu adalah membuat
-- kebijakan terlihat lebih ketat daripada yang sebenarnya diputuskan.
drop policy if exists cases_select_in_scope on cases;
drop policy if exists cases_insert_in_scope on cases;
drop policy if exists cases_update_in_scope on cases;

create policy cases_select_ocs on cases
  for select to authenticated
  using (caller_may('irregularities', 'view'));
create policy cases_insert_ocs on cases
  for insert to authenticated
  with check (caller_may('irregularities', 'input'));
create policy cases_update_ocs on cases
  for update to authenticated
  using (caller_may('irregularities', 'input'))
  with check (caller_may('irregularities', 'input'));

-- ─── customers ───────────────────────────────────────────────────────────────
-- Dibaca oleh siapa pun yang memegang kontrak atau CRM, tetap di dalam scope
-- kontraknya. Tidak ada jalan tulis: customers ikut Sheet.
drop policy if exists customers_insert_writer on customers;

drop policy if exists customers_select_in_scope on customers;
create policy customers_select_in_scope on customers
  for select to authenticated
  using (
    (caller_may('kontrak', 'view') or caller_may('crm', 'view'))
    and (
      caller_sees_all_scopes()
      or exists (
        select 1 from contracts c
        where c.customer_id = customers.customer_id
          and in_caller_scope(c.business_line, c.cabang)
      )
    )
  );

-- ─── scenarios ───────────────────────────────────────────────────────────────
-- Satu-satunya modul yang benar-benar ditulis dari web, karena ia lahir di sini
-- dan tidak punya tab di Sheet untuk ditimpa penarikan harian.
drop policy if exists scenarios_select_in_scope     on scenarios;
drop policy if exists scenarios_insert_own          on scenarios;
drop policy if exists scenarios_update_own_undecided on scenarios;
drop policy if exists scenarios_delete_own_draft    on scenarios;
drop policy if exists scenarios_decide_vp           on scenarios;

create policy scenarios_select_in_scope on scenarios
  for select to authenticated
  using (
    caller_may('simulator', 'view')
    and exists (
      select 1 from contracts c
      where c.id = scenarios.contract_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

create policy scenarios_insert_own on scenarios
  for insert to authenticated
  with check (
    caller_may('simulator', 'input')
    and author_id = (select auth.uid())
    and status in ('draft', 'pending')
    and exists (
      select 1 from contracts c
      where c.id = scenarios.contract_id
        and in_caller_scope(c.business_line, c.cabang)
    )
  );

create policy scenarios_update_own_undecided on scenarios
  for update to authenticated
  using (
    caller_may('simulator', 'input')
    and author_id = (select auth.uid())
    and status in ('draft', 'pending')
  )
  with check (author_id = (select auth.uid()) and status in ('draft', 'pending'));

create policy scenarios_delete_own_draft on scenarios
  for delete to authenticated
  using (
    caller_may('simulator', 'input')
    and author_id = (select auth.uid())
    and status = 'draft'
  );

-- Menyetujui adalah keputusan, bukan penyuntingan data — satu-satunya hal yang
-- ditulis oleh sebuah role yang selain itu hanya membaca. Direktur Utama sengaja
-- tidak memegangnya: matriks klien menyebut izinnya identik dengan VP, dan
-- keputusan ini diambil sadar, bukan disimpulkan.
create policy scenarios_decide on scenarios
  for update to authenticated
  using (caller_may('simulator', 'approve') and status = 'pending')
  with check (caller_may('simulator', 'approve') and status in ('approved', 'rejected'));

-- ─── notifications ───────────────────────────────────────────────────────────
-- Tetap milik penerimanya, dengan grant modul sebagai lapisan kedua sehingga
-- super admin tidak menerima apa pun.
drop policy if exists notifications_select_own on notifications;
drop policy if exists notifications_update_own on notifications;

create policy notifications_select_own on notifications
  for select to authenticated
  using (caller_may('notifikasi', 'view') and recipient_id = (select auth.uid()));
create policy notifications_update_own on notifications
  for update to authenticated
  using (caller_may('notifikasi', 'view') and recipient_id = (select auth.uid()))
  with check (caller_may('notifikasi', 'view') and recipient_id = (select auth.uid()));

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Tetap terbaca oleh semua yang masuk, karena nama penulis skenario ditampilkan
-- di layar persetujuan. Yang baru adalah jalan tulisnya: super admin saja.
create policy profiles_write_super_admin on profiles
  for all to authenticated
  using (caller_may('pengguna', 'manage'))
  with check (caller_may('pengguna', 'manage'));

-- Dibuang terakhir, setelah kebijakan terakhir yang memanggilnya hilang.
drop function if exists caller_may_write();
