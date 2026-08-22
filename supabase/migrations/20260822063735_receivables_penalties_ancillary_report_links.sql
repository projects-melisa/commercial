-- Empat tabel baru, kolomnya mengikuti header sheet-nya masing-masing supaya
-- penarikan harian menjadi pemetaan satu-satu, bukan penafsiran.

/**
 * Piutang. Sumber: tab Receivable_Data.
 *
 * Tidak punya kolom station. Karena itu ia tidak bisa di-scope per cabang tanpa
 * mengarang isinya, dan aksesnya diputuskan murni oleh grant modul: cabang tidak
 * memegang 'piutang' sama sekali, jadi nol baris sampai kepadanya.
 */
create table receivables (
  customer_id text primary key references customers (customer_id) on delete cascade,
  status      text not null check (status in ('OPEN', 'CLOSED')),
  d0_30       bigint not null default 0,
  d31_60      bigint not null default 0,
  d61_90      bigint not null default 0,
  d91_120     bigint not null default 0,
  d121_150    bigint not null default 0,
  d151_180    bigint not null default 0,
  d181_360    bigint not null default 0,
  d360_plus   bigint not null default 0,
  total       bigint not null default 0,
  synced_at   timestamptz not null default now()
);

/**
 * Penalty. Sumber: tab Penalty_Data, yang masih kosong.
 *
 * `tahap` menampung dua alur sekaligus. Dokumen menulis alur ideal — customer ke
 * cabang, cabang memvalidasi, klaim terbit, laporan ke OP — dan mengakui bahwa
 * kenyataannya customer sering langsung ke Commercial. Sistem tidak memaksa yang
 * ideal; ia hanya mencatat sebuah kasus sedang berdiri di mana, sehingga kedua
 * jalur bisa masuk tanpa ada yang harus diisi bohong.
 */
create table penalties (
  id              uuid primary key default gen_random_uuid(),
  customer_id     text not null references customers (customer_id) on delete cascade,
  deskripsi       text not null,
  nilai           bigint,
  cabang_asal     text references cabang (kode),
  tahap           text not null default 'dilaporkan'
                  check (tahap in ('dilaporkan', 'divalidasi_cabang', 'klaim_terbit',
                                   'dilaporkan_ke_op', 'ditutup')),
  dilaporkan_pada date,
  synced_at       timestamptz not null default now()
);

create index penalties_customer_idx on penalties (customer_id);

/**
 * Pendapatan ancillary. Sumber: tab Ancillary_Data.
 *
 * Berbeda dari dua tabel di atas, ia PUNYA kolom cabang yang berisi kode bandara
 * sungguhan, sehingga scope per cabang di sini nyata dan bisa dibuktikan.
 *
 * Kolomnya sengaja bernama seperti header sheet-nya — termasuk `group_1_gl` yang
 * kikuk — supaya tidak ada penerjemahan diam-diam antara apa yang diisi klien dan
 * apa yang dibaca aplikasi.
 */
create table ancillary_revenues (
  id          uuid primary key default gen_random_uuid(),
  cab         text not null,
  plan_actual text not null check (plan_actual in ('Plan', 'Actual')),
  customer    text not null,
  periode     date not null,
  tahun       smallint not null,
  production  integer not null default 0,
  total       bigint  not null default 0,
  text_pl     text,
  group_1_gl  text,
  group_2_gl  text,
  group_3_gl  text,
  synced_at   timestamptz not null default now()
);

create index ancillary_cab_periode_idx on ancillary_revenues (cab, tahun, periode);
create index ancillary_plan_actual_idx on ancillary_revenues (plan_actual, tahun);
create index ancillary_group1_idx      on ancillary_revenues (group_1_gl);

/**
 * Tempat menautkan Power BI, satu per modul.
 *
 * Tautannya adalah tombol keluar, bukan iframe: URL embed yang diberikan klien
 * membawa tenant Microsoft mereka, sehingga siapa pun di luar tenant itu akan
 * melihat formulir login Microsoft tertanam di tengah halaman. Tombol keluar jujur
 * tentang ke mana ia membawa orang.
 */
create table report_links (
  modul app_module primary key,
  judul text not null,
  url   text not null,
  aktif boolean not null default true
);

-- ─── Kebijakan ───────────────────────────────────────────────────────────────
-- Setiap tabel membaca izinnya lewat caller_may, dan hanya ancillary_revenues
-- yang menambahkan sumbu cabang, karena hanya ia yang punya kolomnya.

alter table receivables        enable row level security;
alter table penalties          enable row level security;
alter table ancillary_revenues enable row level security;
alter table report_links       enable row level security;

create policy receivables_select on receivables
  for select to authenticated using (caller_may('piutang', 'view'));
create policy receivables_insert on receivables
  for insert to authenticated with check (caller_may('piutang', 'input'));
create policy receivables_update on receivables
  for update to authenticated
  using (caller_may('piutang', 'input')) with check (caller_may('piutang', 'input'));

create policy penalties_select on penalties
  for select to authenticated using (caller_may('penalty', 'view'));
create policy penalties_insert on penalties
  for insert to authenticated with check (caller_may('penalty', 'input'));
create policy penalties_update on penalties
  for update to authenticated
  using (caller_may('penalty', 'input')) with check (caller_may('penalty', 'input'));

-- Cabang yang null di sisi pemanggil berarti "semua cabang", persis seperti yang
-- dibaca in_caller_scope pada dimensi yang sama.
create policy ancillary_select_in_scope on ancillary_revenues
  for select to authenticated
  using (
    caller_may('pendapatan', 'view')
    and (caller_cabang() is null or cab = caller_cabang())
  );

create policy report_links_select on report_links
  for select to authenticated
  using (caller_may('report_links', 'view') or caller_may('report_links', 'manage'));
create policy report_links_write on report_links
  for all to authenticated
  using (caller_may('report_links', 'manage'))
  with check (caller_may('report_links', 'manage'));
