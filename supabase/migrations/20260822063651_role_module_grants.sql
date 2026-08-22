-- Sumbu kedua dari kendali akses.
--
-- `in_caller_scope` sudah menjawab "dari baris yang boleh disentuh, mana saja".
-- Yang belum ada adalah "modul mana yang boleh disentuh sama sekali" — dan itulah
-- yang membedakan kesembilan role satu sama lain: Finance memiliki piutang, OP
-- memiliki penalty, OCS memiliki irregularities. Perbedaannya bukan di scope.
--
-- Ditulis sebagai tabel, bukan sebagai daftar role di dalam tiap policy. Empat
-- domain dikali sembilan role akan menyebarkan izin ke puluhan tempat, dan satu
-- policy yang tertinggal saat role baru ditambahkan tidak akan gagal — ia hanya
-- diam-diam memberi lebih dari yang seharusnya.

create type app_module as enum (
  'kontrak', 'crm', 'simulator', 'piutang', 'penalty',
  'irregularities', 'pendapatan', 'notifikasi', 'report_links', 'pengguna'
);

create type grant_action as enum ('view', 'input', 'approve', 'manage');

create table role_module_grants (
  role  user_role    not null,
  modul app_module   not null,
  aksi  grant_action not null,
  primary key (role, modul, aksi)
);

comment on table role_module_grants is
  'Peta role ke modul. Hanya bisa diubah lewat migrasi — lihat kebijakan di bawah.';

insert into role_module_grants (role, modul, aksi) values
  -- Commercial KPS — pusat monitoring; satu-satunya yang membuat skenario.
  ('commercial_kps', 'kontrak',      'view'),
  ('commercial_kps', 'crm',          'view'),
  ('commercial_kps', 'simulator',    'view'),
  ('commercial_kps', 'simulator',    'input'),
  ('commercial_kps', 'piutang',      'view'),
  ('commercial_kps', 'penalty',      'view'),
  ('commercial_kps', 'pendapatan',   'view'),
  ('commercial_kps', 'notifikasi',   'view'),
  ('commercial_kps', 'report_links', 'view'),

  -- VP — memantau seluruh portofolio. Menyetujui skenario adalah satu-satunya
  -- hal yang ia tulis, dan itu keputusan, bukan penyuntingan data.
  ('vp', 'kontrak',      'view'),
  ('vp', 'crm',          'view'),
  ('vp', 'simulator',    'view'),
  ('vp', 'simulator',    'approve'),
  ('vp', 'piutang',      'view'),
  ('vp', 'penalty',      'view'),
  ('vp', 'pendapatan',   'view'),
  ('vp', 'notifikasi',   'view'),
  ('vp', 'report_links', 'view'),

  -- Direktur Utama — identik VP tanpa stempel persetujuan.
  ('direktur_utama', 'kontrak',      'view'),
  ('direktur_utama', 'crm',          'view'),
  ('direktur_utama', 'simulator',    'view'),
  ('direktur_utama', 'piutang',      'view'),
  ('direktur_utama', 'penalty',      'view'),
  ('direktur_utama', 'pendapatan',   'view'),
  ('direktur_utama', 'notifikasi',   'view'),
  ('direktur_utama', 'report_links', 'view'),

  -- Cabang — pendapatan cabangnya sendiri, dan tidak ada yang lain. Requirement
  -- 1.0 menyebutnya dua kali: "cabang tidak menjadi role input kontrak".
  ('cabang', 'pendapatan',   'view'),
  ('cabang', 'notifikasi',   'view'),
  ('cabang', 'report_links', 'view'),

  -- Finance KPS — pemilik piutang.
  ('finance_kps', 'kontrak',      'view'),
  ('finance_kps', 'piutang',      'view'),
  ('finance_kps', 'piutang',      'input'),
  ('finance_kps', 'penalty',      'view'),
  ('finance_kps', 'notifikasi',   'view'),
  ('finance_kps', 'report_links', 'view'),

  -- OP KPS — pemilik konsolidasi penalty.
  ('op_kps', 'kontrak',      'view'),
  ('op_kps', 'penalty',      'view'),
  ('op_kps', 'penalty',      'input'),
  ('op_kps', 'notifikasi',   'view'),
  ('op_kps', 'report_links', 'view'),

  -- OS KPS — matriks hanya menulis "sesuai pembagian peran OP / OS / OCS".
  -- Sementara: membaca kontrak dan penalty. Ditandai C-12 untuk dikonfirmasi.
  ('os_kps', 'kontrak',      'view'),
  ('os_kps', 'penalty',      'view'),
  ('os_kps', 'notifikasi',   'view'),
  ('os_kps', 'report_links', 'view'),

  -- OCS KPS — satu-satunya pemegang irregularities, baca maupun tulis.
  ('ocs_kps', 'kontrak',        'view'),
  ('ocs_kps', 'irregularities', 'view'),
  ('ocs_kps', 'irregularities', 'input'),
  ('ocs_kps', 'penalty',        'view'),
  ('ocs_kps', 'notifikasi',     'view'),
  ('ocs_kps', 'report_links',   'view'),

  -- Super Admin — mengatur siapa memegang role apa, dan tidak melihat satu baris
  -- pun data bisnis. Memisahkan "mengatur akses" dari "melihat data" berarti akun
  -- yang paling sering dibagikan justru yang paling sedikit bisa dibaca.
  ('super_admin', 'pengguna',     'manage'),
  ('super_admin', 'report_links', 'manage');

/**
 * Apakah pemanggil memegang satu izin.
 *
 * security definer karena ia membaca profiles, yang policy-nya sendiri tidak
 * boleh ikut menentukan jawaban. stable karena dipanggil berkali-kali per query.
 */
create function caller_may(m app_module, a grant_action) returns boolean
  language sql
  stable
  security definer
  set search_path = ''
as $$
  select exists (
    select 1
    from public.role_module_grants g
    where g.modul = m
      and g.aksi  = a
      and g.role  = (select role from public.profiles where id = (select auth.uid()))
  )
$$;

revoke execute on function caller_may(app_module, grant_action) from public, anon;
grant  execute on function caller_may(app_module, grant_action) to authenticated;

-- Tabel ini dibaca semua orang dan ditulis tidak seorang pun.
--
-- Tanpa aturan ini, siapa saja yang bisa menulis ke sini bisa memberi dirinya
-- sendiri akses apa pun, dan seluruh RBAC di bawahnya menjadi hiasan. Super admin
-- mengatur SIAPA MEMEGANG role apa; ia tidak mengatur ROLE ITU BOLEH APA.
alter table role_module_grants enable row level security;

create policy grants_select_authenticated on role_module_grants
  for select to authenticated
  using (true);
-- Sengaja tanpa policy insert/update/delete. Hanya service role dan migrasi.
