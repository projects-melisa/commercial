# Gapura OneClick Commercial

**Spesifikasi Teknis & Produk · Edisi 01 · 22 Agustus 2026**

Satu pintu buat kontrak, pendapatan, piutang, penalty, dan irregularities — dengan hak akses yang diputusin database, bukan tampilan.

| | |
|---|---|
| **Supabase** | `aixotkyuhhuapqsldapu` (region ap-southeast-1, Postgres 17.6) |
| **Web** | https://oneclick-commercial.vercel.app |
| **Database utama** | Google Sheet `Master_Database_Komersial_Compiled` (8 tab) |
| **Sumber spec** | xlsx requirement · COMMERSIL.docx · 7 Google Sheet · 6 tangkapan Power BI · skema Supabase yang jalan |
| **Status** | Fase 1–5 selesai · C-16 terjawab · 18 butir butuh konfirmasi klien |

---

## Daftar isi

1. [Ringkasnya gini](#1-ringkasnya-gini)
2. [Masalah yang lagi dipecahin](#2-masalah-yang-lagi-dipecahin)
3. [Ruang lingkup](#3-ruang-lingkup)
4. [Inventaris sumber data](#4-inventaris-sumber-data)
5. [Arsitektur ruang — dua workspace](#5-arsitektur-ruang--dua-workspace)
6. [RBAC](#6-rbac)
7. [Model data](#7-model-data)
8. [Alur data & sinkronisasi](#8-alur-data--sinkronisasi)
9. [Spesifikasi modul](#9-spesifikasi-modul)
10. [Rumus & nilai turunan](#10-rumus--nilai-turunan)
11. [Desain frontend](#11-desain-frontend)
12. [Peta rute](#12-peta-rute)
13. [Rencana pengujian](#13-rencana-pengujian)
14. [Fase kerja & urutan migrasi](#14-fase-kerja--urutan-migrasi)
15. [Risiko & butuh konfirmasi](#15-risiko--butuh-konfirmasi)
16. [Lampiran](#16-lampiran)

---

## 1. Ringkasnya gini

Sekarang orang Commercial harus buka lima tempat buat mutusin satu kontrak diperpanjang atau enggak: data kontrak di spreadsheet, segmentasi di CRM, kasus di OCS, piutang di Finance, penalty nyecer di cabang. Spec ini nyatuin semuanya jadi satu web — tapi **tanpa mindahin kerjaan input mereka**.

Tiga kalimat yang paling penting:

1. **Google Sheet tetap sumber kebenaran.** Web-nya cermin, bukan tempat ngetik. Cron harian narik Sheet ke Supabase; arah baliknya dihapus permanen.
2. **Hak akses hidup di database.** Sembilan role, satu tabel grant, satu fungsi pengecek. Nyembunyiin tombol di UI itu kosmetik — yang beneran ngejaga adalah RLS.
3. **Dua workspace, bukan satu menu panjang.** Habis login, role KPS milih *Kontrak Commercial* atau *Pendapatan*. Cabang gak milih — dia langsung dilempar ke pendapatan cabangnya sendiri.

### Yang berubah dari yang udah jalan

| Berubah | Dari | Jadi |
|---|---|---|
| Role | 3 (`vp`, `commercial`, `cabang`) | 9 |
| CRUD kontrak di web | Ada (`/kontrak/baru`, `/kontrak/[id]` edit) | **Dicabut** |
| Halaman masuk | Langsung ke dashboard | Bento 2 kartu (kecuali cabang) |
| Tabel | 8 | 12 |
| Mirror Supabase → Sheet | Ada tapi cron dimatiin | **Dihapus dari kode** |
| Kasus di halaman pelanggan | Kelihatan Commercial | Cuma OCS |
| Modul | Kontrak, CRM, Simulator, Notifikasi | + Pendapatan, Piutang, Penalty, Irregularities, Link PBI, Pengguna |

---

## 2. Masalah yang lagi dipecahin

Requirement barisnya nulis sendiri:

> *"Monitoring kontrak untuk mempercepat keputusan renew/no-renew kontrak, tanpa cek manual ke banyak unit dan data (Commercial, CRM, Irregularities, CRB, Finance)."*

Jadi produknya bukan "dashboard". Produknya **satu keputusan**: kontrak ini diperpanjang atau enggak. Tiap hal yang ditampilin harus bisa jawab "ini ngebantu mutusin itu, gak?". Kalau enggak, dia bukan prioritas.

### Empat domain yang diminta

| Domain | Request | Pemilik data | Kondisi sekarang |
|---|---:|---|---|
| **Kontrak** — Commercial | 5 | Commercial KPS per LoB | Udah jalan di web |
| **Pendapatan** — Ancillary | 2 | Commercial | **harian**: 8.155 baris per 22 Agu 2026, tumbuh ±380 baris/bulan |
| **Piutang** — Finance | 1 | Finance KPS | 9 baris, sudah tampil di `/piutang` |
| **Penalty** — OP/OS/OCS | 4 | OP KPS | 12 baris dummy di sheet |

### Alur bisnis penalty — ideal vs nyata

Dokumen nulis dua-duanya, dan sistem harus nampung dua-duanya:

```
IDEAL : Customer → Cabang (validasi) → klaim keluar → laporan internal ke OP
NYATA : Customer → Commercial → Commercial bantu validasi ke cabang → info ke OP
```

Sistem **gak maksa** alur idealnya. Dia cuma nyatet satu kasus lagi berdiri di mana, jadi kedua jalur bisa masuk tanpa ada yang harus bohong pas ngisi.

---

## 3. Ruang lingkup

### Masuk

- Migrasi RBAC dari 3 role ke 9, plus tabel grant modul
- Empat tabel baru: `receivables`, `penalties`, `ancillary_revenues`, `report_links`
- Halaman bento pilih workspace + routing per role
- Dashboard Pendapatan gaya Power BI (6 tab)
- Halaman Piutang, Penalty, Irregularities
- Cron tarik Sheet → Supabase buat 6 tab yang punya data (dua sisanya indeks & duplikat)
- Penajaman visual halaman existing pakai detail dari Power BI
- Data dummy `Ancillary_Data` + `Penalty_Data`

### Gak masuk

- Embed Power BI di dalam halaman (cuma tombol keluar — lihat [C-14](#15-risiko--butuh-konfirmasi))
- Upload file dokumen kontrak (pakai link Drive)
- Form input revenue/kontrak/piutang di web (input tetap di Sheet)
- Integrasi langsung ke sistem Finance
- Aplikasi mobile native

---

## 4. Inventaris sumber data

Tujuh spreadsheet kebaca lewat akun `projects.melisa@gmail.com`. Yang jadi database utama adalah **Master_Database_Komersial_Compiled** — ini yang kepasang di `GOOGLE_SHEET_ID`.

### 4.1 Tab di Master

| Tab | gid | Isi | Baris | Status |
|---|---|---|---:|---|
| `Compiled_Contracts` | 0 | Gabungan GH + Cargo + Ancillary | 12 | Ada isi |
| `Revenue_Data` | 2054071609 | Tarif/Cost/Min_GPM_Target — **bukan** revenue | 20 | Nama menyesatkan. `Min_GPM_Target` ditarik ke `contracts` |
| `CS_Data` | 223705593 | Irregularities | 10 | Ada isi |
| `CRM_Data` | 440325149 | RFM + skor | 9 | Ada isi |
| `Receivable_Data` | 1829649668 | 8 bucket aging + total | 9 | Ada isi |
| `Penalty_Data` | 909911719 | Penalty per customer + tahap | 12 | **Dummy** — header kita, [C-15](#15-risiko--butuh-konfirmasi) |
| `Ancillary_Data` | 2099620204 | RKAP & Aktual per cabang/**hari**/GL | 8.155 | **Live** — harian sejak klien mengisi; kunci tarik diperlebar ke `group_2_gl, group_3_gl` (audit D-1) |
| `Link Data` | 44768215 | Indeks 6 sheet sumber | 6 | Ada isi |

### 4.2 Sheet sumber (dari tab `Link Data`)

| # | Nama | ID | Baris |
|---|---|---|---:|
| 1 | GH — Kontrak | `16hvHO7HtGS9v07HO7UNAAGh1rCDrwc8XeK_yEZlDWfw` | 9 |
| 2 | CGO — Cargo | `1CZoK2V1Tc2bRmDhA1HTxv1DOucRpz9h4GGMQ5FMz-Oc` | 1 |
| 3 | OB — Ancillary | `1RgaONOT7TQwNfjvCIbaUPrMFGiUd1LvljJ_uDb5Ot4M` | 2 |
| 4 | OCS — Irreg | `1eGmrF6zSy4dLUb4G-Tvykkt1l1V1dy3tu0hGby1VkqM` | 10 |
| 5 | CRM — Segmentation | `1SxYnQT6x5MCVqTjjbcvvMsYrKuasVlaZ7s-ooOriDqo` | 9 |
| 6 | AR — Piutang | `1lL5enomiSvI7_niTQGRVmYYGXb5sor5oPsWyf9YSdNM` | 9 |

> Sheet #4 (OCS Irreg) **gak terdaftar di xlsx requirement**. Dia cuma ketahuan dari tab `Link Data` di dalam Master.

### 4.3 Skema tiap sumber

**Kontrak** (GH · CGO · OB · Compiled_Contracts)

```
ContractID · CustomerID · CustomerName · Station · Status · BusinessLine
ContractStartDate · ContractEndDate · Sisa Kontrak (Hari)
Tarif/Handling · HPP/Handling¹ · PIC Customer · Number PIC · Email PIC
Remarks · Latest Contract
```
¹ GH dan CGO nulis `HPP/Handling`; OB nulis `Cost/Handling`. Kolom yang sama, nama beda — lihat [C-10](#15-risiko--butuh-konfirmasi).

**CRM_Data** — `CustomerID · CustomerName · RFM_Status · Frequency Score · Monetary Score · Recency Score`

**Receivable_Data** — `CustomerID · CustomerName · Receivable Status · 0-30 Days · 31-60 Days · 61-90 Days · 91-120 Days · 121-150 Days · 151-180 Days · 181-360 Days · >360 Days · Total`

> Header bucket-nya berakhiran ` Days`. Edisi sebelumnya nulis `0-30` tanpa itu, dan pull pertama gagal di tab ini gara-gara beda satu kata — ketahuan justru karena kegagalannya per-tab, tiga tab lain tetap masuk.

**CS_Data / Irreg** — `CustomerID · CaseDescription · CaseStatus`

**Revenue_Data** — `CustomerID · ServiceType · Tarif_Existing (IDR) · Cost_Existing (IDR) · Min_GPM_Target (%)`

> **Temuan penting.** `Revenue_Data` itu **bukan** data revenue. Isinya bahan simulator P&L. Data pendapatan yang beneran adanya di `Ancillary_Data`, dan tab itu masih kosong. Di kode dia dibaca sebagai *sumber target margin*, bukan revenue, biar namanya gak bikin salah paham lagi.

### 4.4 Header `Ancillary_Data` — kontrak yang harus dipenuhi

Struktur ini datang dari tangkapan layar di COMMERSIL.docx, dan dia yang nentuin 6 dashboard Power BI bisa dibangun atau enggak.

```
Cab | PLAN/ACTUAL | Customer | Periode | Tahun | Production
    | Total of Reporting Period | text P/L | group 1 GL | group 2 GL | group 3 GL

contoh:
AMQ | Actual | GAPURA PRAGATA LOGISTIK | 1/1/2025 | 2025 | 1
    | 6.000.000 | OB REVENUE | LOGISTIK | OTHER BUSINESS |
```

Pemetaan ke dashboard:

| Kolom | Dipakai buat |
|---|---|
| `Cab` | Ranking airport · scope cabang · filter HUB |
| `PLAN/ACTUAL` | Misahin RKAP dari Aktual → kartu Diff dan %Ach |
| `Periode` + `Tahun` | Tren bulanan · tren harian · YoY 2025 vs 2026 |
| `Production` | Tab Produksi dan Production (UP) |
| `Total of Reporting Period` | Nilai revenue |
| `group 1 GL` | Ranking Line of Business |
| `group 2/3 GL` | Hierarki GL buat drill-down |
| `text P/L` | Klasifikasi P&L |

---

## 5. Arsitektur ruang — dua workspace

Habis login, role KPS gak langsung dilempar ke halaman. Dia dapet layar pilihan — bukan karena keren, tapi karena dua workspace ini beda cara pakainya: satu buat mutusin per-kontrak, satu buat baca performa portofolio.

### Kartu 1 — Kontrak Commercial

Kontrak · Segmentasi CRM · Simulator P&L · Ringkasan Piutang · Ringkasan Penalty · Irregularities.

Semuanya bahan buat satu keputusan: perpanjang atau enggak. Isi kartu di-gate RBAC di dalamnya — dua orang yang klik kartu yang sama bisa lihat isi yang beda.

### Kartu 2 — Pendapatan

RKAP vs Aktual · tren bulanan & harian · YoY · produksi · ranking LoB / airport / cabang. Gaya Power BI.

### Routing per role

| Role | Habis login masuk ke | Kartu yang kelihatan |
|---|---|---|
| `commercial_kps` | `/pilih` | Kontrak Commercial · Pendapatan |
| `vp` | `/pilih` | Kontrak Commercial · Pendapatan |
| `direktur_utama` | `/pilih` | Kontrak Commercial · Pendapatan |
| `finance_kps` | `/pilih` | Kontrak Commercial · Pendapatan |
| `op_kps` | `/pilih` | Kontrak Commercial · Pendapatan |
| `os_kps` | `/pilih` | Kontrak Commercial · Pendapatan |
| `ocs_kps` | `/pilih` | Kontrak Commercial · Pendapatan |
| `cabang` | **`/pendapatan` langsung** | — (gak lewat bento) |
| `super_admin` | `/pengguna` langsung | — |

Keempat unit KPS ini duduk di scope yang sama dengan `commercial_kps` — tanpa
`business_line`, tanpa `cabang` — jadi tidak ada alasan scope buat menahan mereka dari
bacaan performa portofolio yang sudah dipegang role HQ lain.

> **GM Cabang gak lewat bento sama sekali.** Dia langsung di-redirect ke pendapatan cabangnya. Tombol Piutang, Penalty, Irregularities, dan Kontrak gak ada di navigasinya — bukan disabled, tapi gak dirender.

---

## 6. RBAC

Delapan role dari matriks klien, plus satu yang kita tambahin karena matriksnya bolong: gak ada yang bisa bikin user.

### 6.1 Sembilan role

| Role | Kode | Unit | Buat apa |
|---|---|---|---|
| Commercial KPS | `commercial_kps` | KPS / Commercial | Pusat monitoring kontrak & pendapatan, bikin skenario P&L |
| VP | `vp` | Eksekutif | Monitoring portofolio + **satu-satunya yang approve skenario** |
| Direktur Utama | `direktur_utama` | Eksekutif | Monitoring portofolio, murni baca |
| Cabang / Station | `cabang` | Cabang | Baca pendapatan cabangnya sendiri, itu doang |
| Finance KPS | `finance_kps` | KPS / Finance | Aging receivable dan akumulasi piutang |
| OP KPS | `op_kps` | KPS / Operations | Konsolidasi penalty di KPS |
| OS KPS | `os_kps` | KPS / OS | Baca penalty & kontrak — *belum jelas, [C-12](#15-risiko--butuh-konfirmasi)* |
| OCS KPS | `ocs_kps` | KPS / OCS | Irregularities — satu-satunya yang boleh, baca maupun tulis |
| Super Admin | `super_admin` | Sistem | Manajemen user doang. **Nol akses data bisnis** |

### 6.2 Matriks grant

`L` = lihat · `L+I` = lihat & input · `L+A` = lihat & approve · `Kelola` = manajemen · `—` = nol akses

| Modul | Comm | VP | Dirut | Cabang | Finance | OP | OS | OCS | SuperAdm |
|---|---|---|---|---|---|---|---|---|---|
| Kontrak | L | L | L | — | L | L | L | L | — |
| Segmentasi CRM | L | L | L | — | — | — | — | — | — |
| Simulator P&L | L+I | L+A | L | — | — | — | — | — | — |
| Piutang | L | L | L | — | L+I | — | — | — | — |
| Penalty | L | L | L | — | L | L+I | L | L | — |
| Irregularities | — | — | — | — | — | — | — | L+I | — |
| Pendapatan | L | L | L | L¹ | — | — | — | — | — |
| Notifikasi | L | L | L | L | L | L | L | L | — |
| Link Power BI | L | L | L | L | L | L | L | L | Kelola |
| Pengguna & role | — | — | — | — | — | — | — | — | Kelola |

¹ Cabangnya sendiri doang. CGK cuma CGK, HLP cuma HLP.

### 6.3 Model teknis

Dua sumbu yang gak boleh nyampur:

- **Sumbu modul** — role ini boleh nyentuh modul apa. Tabel `role_module_grants`, dibaca lewat `caller_may(modul, aksi)`.
- **Sumbu scope** — dari baris yang boleh dia sentuh, mana aja. Ini yang udah ada: `in_caller_scope(business_line, cabang)`.

Policy nulisnya jadi:

```sql
using ( caller_may('kontrak', 'view') and in_caller_scope(business_line, cabang) )
```

Nambah role atau modul = *insert satu baris*, bukan bongkar tiga puluh policy. Ini niru pola yang udah kepakai di repo — `in_caller_scope` dibikin persis buat alasan yang sama, dan `caller_may_write()` udah ditulis sebagai "bukan vp" supaya role keempat gak perlu ngedit baris itu.

### 6.4 DDL

```sql
-- Enum lama cuma ('vp','commercial'). Diganti, bukan ditambahin, karena
-- 'commercial' berubah nama jadi 'commercial_kps'.
create type user_role_new as enum (
  'commercial_kps','vp','direktur_utama','cabang',
  'finance_kps','op_kps','os_kps','ocs_kps','super_admin');

create type app_module as enum (
  'kontrak','crm','simulator','piutang','penalty',
  'irregularities','pendapatan','notifikasi','report_links','pengguna');

create type grant_action as enum ('view','input','approve','manage');

create table role_module_grants (
  role  user_role_new not null,
  modul app_module    not null,
  aksi  grant_action  not null,
  primary key (role, modul, aksi)
);

-- Dibaca ribuan kali per request, jadi stable + security definer.
create function caller_may(m app_module, a grant_action) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.role_module_grants g
    where g.modul = m
      and g.aksi  = a
      and g.role  = (select role from public.profiles where id = (select auth.uid())))
$$;

revoke execute on function caller_may(app_module, grant_action) from public, anon;
grant  execute on function caller_may(app_module, grant_action) to authenticated;
```

### 6.5 Isi tabel grant

```sql
insert into role_module_grants (role, modul, aksi) values
  -- Commercial KPS
  ('commercial_kps','kontrak','view'), ('commercial_kps','crm','view'),
  ('commercial_kps','simulator','view'), ('commercial_kps','simulator','input'),
  ('commercial_kps','piutang','view'), ('commercial_kps','penalty','view'),
  ('commercial_kps','pendapatan','view'), ('commercial_kps','notifikasi','view'),
  ('commercial_kps','report_links','view'),
  -- VP  (approve skenario = satu-satunya tulisnya)
  ('vp','kontrak','view'), ('vp','crm','view'),
  ('vp','simulator','view'), ('vp','simulator','approve'),
  ('vp','piutang','view'), ('vp','penalty','view'),
  ('vp','pendapatan','view'), ('vp','notifikasi','view'), ('vp','report_links','view'),
  -- Direktur Utama  (identik VP, minus approve)
  ('direktur_utama','kontrak','view'), ('direktur_utama','crm','view'),
  ('direktur_utama','simulator','view'), ('direktur_utama','piutang','view'),
  ('direktur_utama','penalty','view'), ('direktur_utama','pendapatan','view'),
  ('direktur_utama','notifikasi','view'), ('direktur_utama','report_links','view'),
  -- Cabang
  ('cabang','pendapatan','view'), ('cabang','notifikasi','view'),
  ('cabang','report_links','view'),
  -- Finance KPS
  ('finance_kps','kontrak','view'), ('finance_kps','piutang','view'),
  ('finance_kps','piutang','input'), ('finance_kps','penalty','view'),
  ('finance_kps','notifikasi','view'), ('finance_kps','report_links','view'),
  -- OP KPS
  ('op_kps','kontrak','view'), ('op_kps','penalty','view'), ('op_kps','penalty','input'),
  ('op_kps','notifikasi','view'), ('op_kps','report_links','view'),
  -- OS KPS
  ('os_kps','kontrak','view'), ('os_kps','penalty','view'),
  ('os_kps','notifikasi','view'), ('os_kps','report_links','view'),
  -- OCS KPS
  ('ocs_kps','kontrak','view'),
  ('ocs_kps','irregularities','view'), ('ocs_kps','irregularities','input'),
  ('ocs_kps','penalty','view'),
  ('ocs_kps','notifikasi','view'), ('ocs_kps','report_links','view'),
  -- Super Admin  (cuma manajemen; nol akses data bisnis)
  ('super_admin','pengguna','manage'), ('super_admin','report_links','manage');
```

### 6.6 Aturan yang kalau dilanggar, RBAC-nya bohong

**`role_module_grants` read-only buat semua orang, termasuk super_admin.** Cuma bisa diubah lewat migration.

```sql
alter table role_module_grants enable row level security;
create policy grants_read_all on role_module_grants
  for select to authenticated using (true);
-- Sengaja gak ada policy insert/update/delete. Service role doang.
```

Kalau tabel ini bisa diedit dari aplikasi, siapapun yang bisa nulis ke situ bisa ngasih dirinya sendiri akses apa aja. Super_admin ngatur **siapa dapet role apa**, bukan **role itu boleh apa**.

**Query di `src/lib/data/` tetep gak boleh bawa filter bisnis sendiri.** Nambahin `.eq('business_line', …)` "biar aman" itu nyembunyiin salah policy, bukan nyegah. RLS yang mutusin apa yang balik.

**Dimensi baru ditambahin di `in_caller_scope`, bukan di policy.** Policy yang ketinggalan pakai predikat lama bakal ngasih GM Cabang seluruh portofolio, karena profil yang discope stasiun gak bawa business line dan otomatis lolos cek lini.

---

## 7. Model data

### 7.1 Tabel yang udah ada

| Tabel | Baris | Berubah? |
|---|---:|---|
| `profiles` | 7 | Ya — kolom `role` ganti tipe, tambah user buat 6 role baru |
| `customers` | 9 | Enggak |
| `contracts` | 15 | Ya — policy pakai `caller_may`; write dicabut; `min_gpm_target` diisi dari `Revenue_Data` |
| `cases` | 10 | Ya — policy jadi OCS-only |
| `scenarios` | 0 | Ya — policy pakai `caller_may` |
| `notifications` | 36 | Ya — policy pakai `caller_may` |
| `sheet_syncs` | 3 | Ya — nambah kolom `tab`. Kolom arah gak jadi: arahnya tinggal satu |
| `cabang` | 79 | Enggak |

### 7.2 Tabel baru

```sql
-- Piutang. Sumber: Receivable_Data. Gak punya kolom station → KPS-only.
create table receivables (
  customer_id  text primary key references customers (customer_id) on delete cascade,
  status       text not null check (status in ('OPEN','CLOSED')),
  d0_30        bigint not null default 0,
  d31_60       bigint not null default 0,
  d61_90       bigint not null default 0,
  d91_120      bigint not null default 0,
  d121_150     bigint not null default 0,
  d151_180     bigint not null default 0,
  d181_360     bigint not null default 0,
  d360_plus    bigint not null default 0,
  total        bigint not null default 0,
  synced_at    timestamptz not null default now()
);

-- Penalty. Sumber: Penalty_Data. KPS-only.
create table penalties (
  id             uuid primary key default gen_random_uuid(),
  customer_id    text not null references customers (customer_id) on delete cascade,
  deskripsi      text not null,
  nilai          bigint,
  cabang_asal    text references cabang (kode),
  tahap          text not null default 'dilaporkan'
                 check (tahap in ('dilaporkan','divalidasi_cabang','klaim_terbit',
                                  'dilaporkan_ke_op','ditutup')),
  dilaporkan_pada date,
  synced_at      timestamptz not null default now()
);
create index penalties_customer_idx on penalties (customer_id);

-- Pendapatan ancillary. Sumber: Ancillary_Data. PUNYA kolom cab → discope per cabang.
create table ancillary_revenues (
  id           uuid primary key default gen_random_uuid(),
  cab          text not null,
  plan_actual  text not null check (plan_actual in ('Plan','Actual')),
  customer     text not null,
  periode      date not null,
  tahun        smallint not null,
  production   integer not null default 0,
  total        bigint  not null default 0,
  text_pl      text,
  group_1_gl   text,
  group_2_gl   text,
  group_3_gl   text,
  synced_at    timestamptz not null default now()
);
create index anc_cab_periode_idx  on ancillary_revenues (cab, tahun, periode);
create index anc_plan_actual_idx  on ancillary_revenues (plan_actual, tahun);
create index anc_group1_idx       on ancillary_revenues (group_1_gl);

-- Slot link ke Power BI. Cuma super_admin yang ngisi.
create table report_links (
  modul   app_module primary key,
  judul   text not null,
  url     text not null,
  aktif   boolean not null default true
);
```

### 7.3 Kenapa piutang & penalty KPS-only

Aturannya satu kalimat: **tabel yang gak punya kolom station berisi kode bandara Indonesia gak bisa discope per-cabang.**

`receivables` cuma punya `customer_id` plus angka aging. Ngasih dia kolom cabang berarti ngarang isinya. Jadi cabang nol akses — bukan akses setengah-setengah yang gak bisa dipertanggungjawabkan.

`ancillary_revenues` beda: dia punya kolom `cab` beneran, jadi scope per-cabang di situ nyata dan bisa dibuktiin.

### 7.4 Pemetaan kolom Sheet → tabel

| Sheet kolom | Tabel.kolom | Transformasi |
|---|---|---|
| `Tarif/Handling` | `contracts.tarif` | Buang pemisah ribuan, ke bigint |
| `HPP/Handling` / `Cost/Handling` | `contracts.cost` | Dua nama → satu kolom |
| `Station` | `contracts.cabang` | `"All Station"` → `null`; `"MDC, BTH"` → pecah jadi 2 baris |
| `Sisa Kontrak (Hari)` | — | **Gak disimpan.** Dihitung dari `ContractEndDate` |
| `Min_GPM_Target (%)` | `contracts.min_gpm_target` | `"0.25 (25%)"` → `0.25`; join per `CustomerID` |
| `Periode` | `ancillary_revenues.periode` | `M/D/YYYY` → `date` |
| `PLAN/ACTUAL` | `ancillary_revenues.plan_actual` | Normalisasi jadi `Plan` / `Actual` |
| `Total of Reporting Period` | `ancillary_revenues.total` | Buang pemisah, ke bigint |
| bucket aging `0-30` … `>360` | `receivables.d0_30` … `d360_plus` | Langsung |

### 7.5 Yang tetap gak disimpan

GPM, sisa hari, status band, %Ach, %YoY, Diff, laba — semuanya dihitung tiap kali dibaca, gak pernah jadi kolom.

Alasannya udah ditulis di repo: *badge di layar dan angka di email gak boleh beda cerita soal kontrak yang sama.* Nambah kolom `gpm` ke `contracts` itu ngundang dua-duanya buat drift.

---

## 8. Alur data & sinkronisasi

### 8.1 Arah

```
Google Sheet (Master, 8 tab)
        │
        │  cron harian, satu arah
        ▼
   Supabase Postgres  ──RLS──►  Next.js  ──►  browser

   Supabase ──X──► Sheet     (dihapus, bukan cuma dimatiin)
```

Mirror arah balik (`Supabase → Sheet`) selama ini ada tapi cron-nya dimatiin, karena dia ngosongin tiap tab terus nulis ulang — artinya dia bisa nimpa kerjaan manual klien pakai salinan yang lebih lama. **Selama kodenya masih ada, dia bisa kepencet.** Jadi dihapus: `src/lib/sheets/sync.ts`, `/api/sheets/sync`, dan cron `g-cme-daily-sheets-mirror`.

### 8.2 Spesifikasi cron tarik

| | |
|---|---|
| **Jadwal** | Harian 02:00 WIB |
| **Baca** | 6 tab di Master, lewat service account (read-only scope). `Link Data` cuma indeks; `Compiled_Contracts`, `CRM_Data` dan `CS_Data` dibaca sekaligus karena integritas referensialnya dicek bareng |
| **Nulis** | `upsert` per baris pakai kunci alami, **bukan** delete-then-insert |
| **Kunci alami** | `contracts` → `(contract_no, cabang)` · `cases` → `(customer_id, description)` · `receivables` → `customer_id` · `ancillary_revenues` → `(cab, plan_actual, customer, periode, group_1_gl)` · `penalties` → `(customer_id, deskripsi, dilaporkan_pada)`. Semuanya `nulls not distinct` |
| **Baris yang hilang** | Ditandai, bukan dihapus. Baris yang ilang dari sheet dikasih `synced_at` lama dan dilaporin, biar salah hapus di sheet gak langsung ngilangin data |
| **Jejak** | Satu baris `sheet_syncs` per tab: status, jumlah baris, durasi, pesan error |
| **Gagal** | Per-tab, bukan per-run. Satu tab gagal gak batalin tab lain |

> **Beda dari seed sekarang.** `pnpm seed:generate` sengaja hapus-dulu-baru-insert, dan itu bener buat seed. Cron **gak boleh** gitu — sekali sheet-nya kosong gara-gara kesalahan manusia, seluruh data produksi ikut hilang.

### 8.3 Akibatnya ke input

Kalau Sheet yang menang, web gak boleh jadi tempat ngetik hal yang punya tab di Sheet.

| Yang diinput | Kata matriks klien | Jadinya di sistem |
|---|---|---|
| Kontrak | Commercial: Input Yes | **Di Sheet.** CRUD kontrak di web dicabut |
| Revenue (incl. cost) | Commercial: Input Yes | **Di Sheet** (`Ancillary_Data`) |
| Piutang | Finance: Input Yes | **Di Sheet** |
| Penalty | OP: Input Yes | **Di Sheet** |
| Irregularities | OCS: Input Yes | **Di Sheet** |
| Skenario P&L | — | **Di web.** Gak punya tab Sheet, jadi aman |
| Approve skenario | — | **Di web.** VP doang |
| User & role | — | **Di web.** Super admin doang |

Kolom "Input/Edit: Yes" di matriks tetap bener — cuma tempatnya spreadsheet, bukan form web. **Ini harus disepakati klien di depan, bukan ketauan pas demo.**

---

## 9. Spesifikasi modul

### 9.1 Kontrak

**Buat siapa** Commercial, VP, Dirut, Finance, OP, OS, OCS (view). Cabang nol akses.

**Nampilin** Tabel kontrak yang bisa disortir dan difilter, plus halaman detail. Yang dibaca orang duluan: **sisa hari** dan **status band**.

Halaman detail nampilin — sesuai permintaan COMMERSIL.docx — *ringkasan piutang* dan *ringkasan penalty* customer itu, di tempat keputusan diambil, bukan di halaman lain.

**Status band** disejajarin sama milestone reminder (60 / 30 / 14 hari), supaya satu kontrak gak bisa dibilang "Aman" di hari dia ngirim reminder.

| Band | Syarat |
|---|---|
| Aman | sisa > 60 hari |
| Perlu Perhatian | 30 < sisa ≤ 60 |
| Kritis | 0 ≤ sisa ≤ 30 |
| Nonaktif | sisa < 0 (expired) |

**Aksi** Cuma baca dan ekspor. Gak ada tombol tambah/ubah/hapus.

**Selesai kalau** Sembilan role login, yang punya grant lihat kontrak sesuai scope-nya, yang enggak dapet halaman 404 — bukan halaman kosong.

---

### 9.2 Pendapatan

**Buat siapa** Commercial, VP, Dirut (semua cabang). Cabang (cabangnya doang).

**Tiga tab utama, dengan sub-tab di dalamnya** — meniru struktur Power BI klien:

| Tab | Sub-tab | Isi |
|---|---|---|
| **Overview** | Revenue | Rupiah, dipecah per `group 1 GL`, plus peringkat pelanggan |
| | Production | Unit, plus **yield** — Rp per unit per LoB dan per cabang |
| | Revenue (UP) | Rupiah pada level Unit Pelaporan: rollup `group 2 GL`, drill `group 3 GL`, plus klasifikasi `text P/L` |
| | Production (UP) | Unit pada level Unit Pelaporan, plus peringkat pelanggan |
| **LoB** | B2C RFM Analysis | Papan RFM pelanggan **Non-Agent** (perorangan) |
| | B2B RFM Analysis | Papan RFM pelanggan **Agent**: total customer, cincin + batang klasifikasi, arti tiap band, sebaran RFM, status hidup, dan tabel detail bergaya *Agent Detail* |
| **Q&A** | — | **Decomposition Tree**: aktual dipecah setingkat demi setingkat (LoB → Airport → Name, tingkatnya bisa diganti), tiap kolom disaring oleh simpul terpilih di kirinya |

> **Sub-tab tidak boleh jadi satu halaman yang sama empat kali.** Yang membedakan ada tiga sekaligus: apa yang dihitung (rupiah vs unit), bagaimana dipotong (`group 1 GL` vs `group 2/3 GL`), dan satu panel yang cuma dimiliki tab itu. Empat salinan satu dashboard adalah empat kesempatan membaca angka yang sama dan mengira dapat informasi baru.

**Susunan tiap tab**

1. Baris KPI — RKAP · Aktual · Diff · %Ach · %YoY
2. Tren bulanan — kolom Aktual 2025 (abu) + Aktual 2026 (hijau), RKAP garis putus-putus
3. Tren harian — **udah ada.** `harianFor` di `revenue.ts` menggambar bentuk hariannya (`overview-panel.tsx` memakainya); tabnya sendiri yang berubah jadi harian. Catatan lama "cuma satu baris per bulan" sudah tidak berlaku
4. Tabel ranking — LoB · Cabang · Pelanggan, tiap baris bawa Diff, %Ach, %YoY
5. Gap performa per cabang — batang menyimpang dari nol

**Filter** Periode · cabang/station · customer · LoB. Nempel di semua tab.

Buat role `cabang`, filter cabang **terkunci dan kelihatan terkunci** — bukan disembunyiin. Kalau disembunyiin, dia gak ngerti kenapa angkanya beda dari yang dia denger di rapat.

**Selesai kalau** Angka di kartu sama persis dengan rumus di bagian 10, dan login sebagai `cabang` CGK cuma balikin baris `cab = 'CGK'`.

---

### 9.3 Piutang

**Buat siapa** Finance (view+input), Commercial/VP/Dirut (view). Cabang nol akses.

**Nampilin** Tabel aging 8 bucket per customer + total. Nilai yang jadi fokus adalah **akumulasi/grand total** — itu yang diminta requirement.

Tombol keluar ke Power BI Finance muncul kalau `report_links` punya entri aktif buat modul `piutang`.

**Selesai kalau** Sembilan baris dari `Receivable_Data` kebaca utuh, dan login sebagai `cabang` balikin nol baris.

---

### 9.4 Penalty

**Buat siapa** OP (view+input), Commercial/VP/Dirut/Finance/OS/OCS (view). Cabang nol akses.

**Nampilin** Tabel konsolidasi + kolom `tahap` yang nunjukin satu kasus lagi berdiri di mana dalam alur validasi. Tombol keluar ke Power BI kalau ada linknya.

**Selesai kalau** Data dummy kebaca, dan tahapnya bisa nampung alur ideal maupun alur nyata tanpa ada yang harus diisi bohong.

---

### 9.5 Irregularities

**Buat siapa** OCS KPS doang, baca maupun tulis.

**Nampilin** Deskripsi kasus + status OPEN/CLOSED per customer.

**Gak muncul di navigasi role lain.** Halaman `/pelanggan/[id]` berhenti nampilin kasus ke Commercial — lihat [R-01](#15-risiko--butuh-konfirmasi).

**Selesai kalau** Login sebagai Commercial gak balikin satu baris pun dari `cases`, dibuktiin lewat tes RLS, bukan lewat UI.

---

### 9.6 Segmentasi CRM

**Buat siapa** Commercial, VP, Dirut.

**Nampilin** RFM (HIGH/MEDIUM/LOW) plus tiga skor. Dipakai sebagai konteks di halaman kontrak: customer HIGH yang mau abis kontraknya beda urgensinya sama LOW.

---

### 9.7 Simulator P&L

**Buat siapa** Commercial (view+input), VP (view+approve), Dirut (view).

Satu-satunya modul yang beneran nulis dari web.

**Alur** Commercial geser tarif dan cost → sistem ngitung laba, GPM, delta terhadap eksisting → band Aman/Warning/Kritis → simpan draft → submit (`pending`) → VP approve atau reject.

**Target margin** `Min_GPM_Target` diambil dari `Revenue_Data`, di-join per CustomerID.

> **Hasilnya tiga keadaan, bukan dua**: memenuhi, melanggar, atau belum ada targetnya. Kode yang nulis `!meetsTarget` bakal ngitung tiap kontrak tanpa target sebagai pelanggaran. Harus `meetsTarget === false`.
>
> Per 22 Agustus 2026 kelima belas kontrak udah punya target (0,20–0,25) karena pull narik `Revenue_Data`. Keadaan ketiga tetap nyata: pelanggan yang gak ada di tab itu tetap `null`.

**Selesai kalau** Finance/OP/OS/OCS/Cabang gak bisa bikin skenario, dan cuma VP yang bisa mindahin status dari `pending`.

---

### 9.8 Pengguna & role

**Buat siapa** Super admin doang.

**Nampilin** Daftar user, role, business line, cabang. Bisa bikin user, ganti role, nonaktifin.

**Gak bisa** Ngintip data bisnis apapun, dan gak bisa ngubah `role_module_grants`.

---

## 10. Rumus & nilai turunan

Power BI-nya kekunci login tenant Microsoft, jadi gak bisa dibuka. Tapi rumus intinya keturunin dari angka di tangkapan layar dan udah dicocokin:

```
Diff   = Aktual − RKAP
         53.942.322.597 − 155.874.024.980 = −101.931.702.383   ✓ cocok

%Ach   = Aktual ÷ RKAP
         53.942.322.597 ÷ 155.874.024.980 = 34,61%             ✓ cocok

%YoY   = (Aktual thn ini − Aktual thn lalu) ÷ Aktual thn lalu
         → −49,38%                                             ✓ cocok
```

Yang dari domain kontrak, udah ada di `src/lib/domain.ts`:

```
GPM             = (Tarif − Cost) ÷ Tarif        (0 kalau tarif ≤ 0)
Laba            = Tarif − Cost
Tarif minimum   = Cost ÷ (1 − target)           ← lantai negosiasi
Sisa kontrak    = ContractEndDate − hari ini    (UTC dua-duanya, biar gak geser timezone)
Memenuhi target = gpm − target > −1e-9          ← epsilon-nya penting
```

> **Kenapa ada epsilon.** `(11000 − 7800) / 11000` gak bisa diwakili persis di floating point. Tanpa epsilon, kontrak yang duduk **tepat** di targetnya bakal dilaporin melanggar. Tiap perbandingan margin lewat fungsi ini, bukan nulis `>=` di tempat masing-masing.

**Yang belum ketebak: ambang warnanya.** Di tangkapan layar, 96,51% ijo · 58,07% oranye · 20,51% merah. Angka potongnya gak ada di dokumen manapun. Sementara pakai `≥95% ijo · 60–94% oranye · <60% merah`, ditandai buat dikonfirmasi ([C-05](#15-risiko--butuh-konfirmasi)).

---

## 11. Desain frontend

Ini **penajaman**, bukan redesign. Identitas visual yang ada dipertahanin; yang ditambahin adalah kepadatan informasi dan disiplin angka yang dipelajari dari Power BI.

### 11.1 Yang dipertahankan

| Token | Nilai | Buat apa |
|---|---|---|
| `--color-primary` | `#1a5c3a` | Aksi utama, navigasi |
| `--color-primary-light` | `#2d7a52` | Hover, aksen sekunder |
| `--color-primary-dark` | `#0f3d27` | Sidebar atas |
| `--color-sidebar-from/to` | `#0f3d27` → `#1e6b42` | Gradien sidebar |
| `--color-canvas` | `#f4f6f9` | Latar halaman |
| `--color-gray-300` | `#858f9e` | Border kontrol — 3.27:1 di putih |
| `--color-gray-400` | `#6b7280` | Teks sekunder — 4.83:1 di putih |

Plus Jakarta Sans tetap jadi font antarmuka.

> **Dua langkah abu-abu yang udah digelapin jangan dibalikin.** Tailwind bawaan ngukur 1,47:1 buat `gray-300` dan 2,54:1 buat `gray-400` — dua-duanya di bawah lantai buat satu-satunya kerjaan yang dikasih ke mereka di codebase ini: border kontrol (butuh 3:1) dan teks sekunder (butuh 4,5:1).

> **Ring fokus dua nada tetap.** Sidebar-nya nyaris sewarna primary; ring hijau polos ngukur 1,54:1 di situ alias gak keliatan. Halo putihnya ngisi celah offset, jadi di permukaan gelap yang kebaca halonya (12,2:1) dan di permukaan terang yang kebaca ring-nya (7,6:1). Satu aturan nutup dua-duanya.

### 11.2 Yang ditambahin

#### Satu font baru, buat angka doang

**IBM Plex Mono** buat semua angka tabel, kode kontrak, kode bandara, dan ID.

Alasannya bukan gaya: kolom Rupiah di dashboard kayak gini isinya 12–15 digit, dan dengan font proporsional digitnya gak lurus ke bawah, jadi mata harus baca tiap angka satu-satu. Semua sel angka pakai `font-variant-numeric: tabular-nums` dan rata kanan.

Font antarmuka tetap **dua**: Plus Jakarta Sans buat teks, IBM Plex Mono buat angka. Gak ada font ketiga.

#### Warna semantik, terpisah dari warna merek

Power BI aslinya ngecat setengah tabel merah, sampai merahnya kehilangan arti. Di sini:

| Token | Nilai | Cuma buat |
|---|---|---|
| `--sem-ok` | `#166534` | Capaian ≥ ambang |
| `--sem-warn` | `#92400e` | Capaian di zona tengah |
| `--sem-bad` | `#991b1b` | Capaian di bawah ambang · Diff negatif |

Hijau merek (`#1a5c3a`) tetap milik navigasi dan tombol, **gak dipakai buat nandain "bagus"** — kalau enggak, hijau tombol dan hijau capaian jadi ketuker.

**Warna gak pernah jadi satu-satunya penanda.** Selalu ada tanda kurung buat negatif, panah arah, atau label teks, biar kebaca sama yang buta warna.

#### Kartu KPI

Tinggi tetap, garis kiri 3px yang ngebawa arti — itu yang kebaca duluan dari jauh, sebelum angkanya. Label kecil huruf besar di atas, angka mono gede di bawah.

#### Kepadatan yang disengaja

Tabel ranking pakai tinggi baris **34px**, bukan 52px. Dashboard operasional itu dipindai, bukan dibaca — dan Power BI-nya nampilin 15+ baris tanpa scroll. Kalau tiap baris dikasih napas ala halaman marketing, orang harus scroll buat ngeliat hal yang seharusnya kelihatan barengan.

Napasnya ditaruh di **antar blok**, bukan di dalam tabel.

#### Grafik

- **Tren bulanan** — kolom: Aktual 2025 abu, Aktual 2026 hijau; RKAP garis putus-putus di atasnya. Bentuk ini emang jawab "kita ketinggalan berapa" dalam sekali lihat.
- **Tren harian** — area dengan titik akhir ditebalin.
- **Gap cabang** — batang menyimpang dari garis nol.
- Sumbu Y diformat ringkas (`Rp15M`, bukan `Rp15.000.000.000`); angka penuhnya keluar di tooltip.
- Grid samar, satu warna sumbu, gak ada gradien 3D, gak ada bayangan di batang.

#### Layar pilih workspace

Dua kartu, gak lebih. Tiap kartu nyebut isinya secara konkret ("kontrak, piutang, penalty, irregularities"), bukan kata benda abstrak, supaya orang gak perlu klik dulu buat tau isinya apa.

**Kartu yang gak dipunya role gak dirender sama sekali**, bukan di-disable — tombol mati cuma ngasih tau ada sesuatu yang disembunyiin.

Sumber kartunya sama persis dengan `role_module_grants`. Jadi bento dan RLS mustahil beda cerita: yang bisa diklik selalu yang bisa diakses.

#### Gerak

Dikit dan ada gunanya. Satu urutan muncul pas halaman kebuka — KPI dulu, baru grafik, baru tabel — pakai `animation-delay` bertahap, biar mata dibawa ke ringkasan sebelum ke detail. Sisanya cuma keadaan hover di baris tabel.

`prefers-reduced-motion` udah dihormati di `globals.css` dan tetap dihormati.

#### Responsif

Di bawah 900px: baris KPI jadi grid 2 kolom · tabel ranking jadi kartu bertumpuk (label + angka) · sidebar jadi drawer. **Grafik tetap grafik** — dikecilin, gak dibuang, karena tren itu justru yang paling sering dilihat dari HP.

### 11.3 Aksesibilitas

- Tiap tabel lebar duduk di `overflow-x: auto` punya sendiri; body halaman gak boleh pernah scroll ke samping
- Kolom pertama tabel ranking `position: sticky`
- Tiap elemen interaktif punya ring fokus yang kelihatan
- Grafik punya padanan tabel yang kebaca screen reader
- Kontras minimum 4,5:1 buat teks, 3:1 buat border kontrol dan batas grafik

> **Jebakan yang udah pernah kena di repo ini.** `.sr-only-text` itu `position: absolute`. Container scroll horizontal manapun yang nampung dia **wajib** punya `position: relative`, kalau enggak teks tersembunyinya ngukur ke containing block awal dan narik halaman ke samping di HP. Dashboard baru ini penuh container scroll — ini bakal kejadian lagi kalau gak dijaga.

---

## 12. Peta rute

| Rute | Modul | Siapa |
|---|---|---|
| `/masuk` | — | Semua |
| `/pilih` | — | Semua role KPS & eksekutif |
| `/kontrak` | kontrak | Grant `kontrak:view` |
| `/kontrak/[id]` | kontrak | Grant `kontrak:view` + dalam scope |
| `/pelanggan` · `/pelanggan/[id]` | crm | Grant `crm:view` |
| `/simulator` | simulator | Grant `simulator:view` |
| `/persetujuan` | simulator | Grant `simulator:approve` — VP doang |
| `/piutang` | piutang | Grant `piutang:view` |
| `/penalty` | penalty | Grant `penalty:view` |
| `/irregularities` | irregularities | Grant `irregularities:view` — OCS doang |
| `/pendapatan` | pendapatan | Grant `pendapatan:view` |
| `/pendapatan/[tab]` · `/pendapatan/[tab]/[sub]` | pendapatan | Overview · LoB · Q&A, dengan sub-tab masing-masing. Q&A menyimpan jalur pohon di query `jalur` |
| `/kritis` | kontrak | Grant `kontrak:view` |
| `/notifikasi` | notifikasi | Semua kecuali super_admin |
| `/laporan` | kontrak | Grant `kontrak:view` |
| `/pengguna` | pengguna | Super admin doang |
| `/pengaturan` | — | Semua |
| ~~`/kontrak/baru`~~ | — | **Dihapus** |

Rute tanpa grant balikin **404**, bukan halaman kosong atau pesan "akses ditolak" — halaman yang ada tapi kosong tetep bocorin bahwa modulnya ada.

---

## 13. Rencana pengujian

Dua seam yang udah ada dipertahanin. Sengaja gak ada lapisan unit test buat derivasi — semuanya diuji lewat output yang kelihatan.

### Seam 1 — RLS (`pnpm test:rls`)

Login beneran sebagai tiap role, bukan mock.

| Yang diuji | Harapan |
|---|---|
| Commercial baca `cases` | **Nol baris** |
| OCS baca `cases` | 10 baris |
| Cabang CGK baca `receivables` | Nol baris |
| Cabang CGK baca `penalties` | Nol baris |
| Cabang CGK baca `ancillary_revenues` | Cuma `cab = 'CGK'` |
| Cabang CGK baca `contracts` | Nol baris |
| Finance baca `contracts` | Sesuai scope |
| Dirut ubah status skenario | Ditolak |
| VP ubah status skenario `pending` | Diterima |
| Super admin baca `contracts` | Nol baris |
| Siapapun tulis `role_module_grants` | Ditolak |
| Reminder edge function pakai service role | Ditolak — harus forward header caller |

### Seam 2 — e2e (`pnpm test:e2e`)

Lewat antarmuka beneran, database di-reset dulu.

- Sembilan persona login, tiap satu lihat kartu bento yang bener
- Cabang di-redirect ke `/pendapatan` tanpa lewat `/pilih`
- Cabang gak punya tombol Piutang/Penalty/Irregularities di navigasi
- Rute tanpa grant balikin 404
- Angka KPI Pendapatan sama dengan hitungan yang diharapkan
- Simulator: Commercial submit → VP approve
- Reminder beneran nyampe Mailpit

### Yang tetap diverifikasi manual

Pengiriman Gmail beneran, dan cocoknya angka sama Power BI. Dua-duanya butuh kredensial pihak ketiga yang kalau dites cuma bakal dipalsuin.

---

## 14. Fase kerja & urutan migrasi

| Fase | Isi | Selesai kalau |
|---|---|---|
| **1 · Fondasi** ✅ | Migrasi 9 role · `role_module_grants` · `caller_may` · 4 tabel baru + policy | Tes RLS lolos buat kesembilan role |
| **2 · Data** ✅ | Dummy `Ancillary_Data` + `Penalty_Data` · cron tarik Sheet→Supabase · mirror balik dihapus | **Selesai.** Pull jalan dua kali berturut-turut, baris gak nambah, `min_gpm_target` selamat |
| **3 · Rangka** ✅ | Bento workspace · redirect cabang · navigasi dari grant · cabut CRUD kontrak | **Selesai.** Enam persona diuji lewat antarmuka; navigasi, kartu bento dan 404 cocok sama matriks grant |
| **4 · Pendapatan** ✅ | 6 tab dashboard · KPI · tren · ranking · filter terkunci per cabang | **Selesai.** KPI cocok bagian 10; GM Cabang yang maksa `?cab=DPS` tetap dapat CGK |
| **5 · Sisanya** ✅ | Piutang · Penalty · Irregularities · `report_links` · `/pengguna` · ringkasan di halaman kontrak | **Selesai.** `pnpm test:rls` 136 lolos. `pnpm test:e2e` sudah ditulis ulang tapi belum dijalankan — butuh stack lokal (Docker) |

### Urutan file migrasi

```
20260822000015_nine_roles_and_grants.sql
20260822000016_receivables_and_penalties.sql
20260822000017_ancillary_revenues.sql
20260822000018_report_links.sql
20260822000019_policies_through_caller_may.sql
20260822000020_cases_ocs_only.sql
20260822000021_drop_sheets_mirror.sql
20260822000022_sheet_pull_schedule.sql
```

> **Prefix angkanya harus unik.** Dua file yang berbagi satu nomor bikin cuma yang pertama yang kepakai. `pnpm deploy:db` sekarang nolak daripada migrasi setengah jalan — jangan diakalin.

---

## 15. Risiko & butuh konfirmasi

Dicatat, bukan dihapus — sesuai catatan di sheet requirement sendiri: *"kebutuhan yang belum final sebaiknya tetap dicatat sebagai Need Confirmation."*

### Risiko dari keputusan yang udah diambil

**R-01 · Commercial buta kasus pas mutusin renew**
Irregularities dikunci OCS-only. Padahal requirement 1.0 justru nyebut Irregularities sebagai salah satu unit yang mau dihindarin cek manualnya. Halaman kontrak jadi gak bisa nampilin "customer ini punya 2 kasus OPEN".

Yang bisa dilakuin cuma jujur soal itu: panel Kasus Layanan di halaman kontrak **gak nulis "belum ada kasus"** ke peran yang gak punya grant — dia nulis bahwa datanya dipegang OCS dan harus ditanya sebelum mutusin. Diam yang kebaca sebagai "aman" itu lebih bahaya daripada gak ada panelnya sama sekali.

**R-02 · Kolom "Input/Edit: Yes" di matriks jadi kosong**
Karena Sheet yang menang, satu-satunya yang bisa ditulis lewat web adalah skenario P&L, notifikasi, dan profil user. Klien harus setuju di depan bahwa input tetap di spreadsheet.

**R-03 · Akses dokumen kontrak di luar RBAC**
Dokumen pakai link Google Drive, bukan upload. Siapapun yang dapet link bisa buka, terlepas dari role-nya. Kontrol aksesnya pindah ke Drive, di luar sistem ini.

**Terjawab · C-16, arti "(UP)"**
Tangkapan layar Power BI klien menjawabnya sendiri: sumber datanya tertulis *"Unit Pelaporan YTD April 2026"* dan *"UP | YTD Mei 2026"*. **UP = Unit Pelaporan** — level agregasi pelaporan, bukan rumus per-unit. Tabel LoB Ranking di tab itu memakai header `group 2 GL`, jadi tab UP di sini menggulung ke `group 2 GL` dan menurunkan ke `group 3 GL`. Dugaan sebelumnya (pendapatan ÷ produksi) salah dan sudah dicabut; rasio itu tetap ada, tapi sebagai **yield** di tab Production, tempat pertanyaannya memang "apakah volume ini layak".

**R-04 · `Ancillary_Data` sekarang berisi angka karangan**
COMMERSIL.docx bilang isinya "harus match dengan PBI". Tabnya kini **harian dan live**: 8.155 baris per 22 Agu 2026 (612 tanggal berbeda), tumbuh ±380 baris per bulan. Tarikan dipotong per 1.000 baris dan route-nya `maxDuration = 300` (audit D-2).

Totalnya sengaja dikalibrasi ke tangkapan layar Power BI, jadi kartu KPI bisa dicocokin sama rumus bagian 10 — RKAP 2026 155.874.024.980, Aktual 2026 53.942.322.597, Diff −101.931.702.383, %Ach 34,61%, %YoY −49,38%. **Yang cocok cuma total dan turunannya; sebarannya per cabang, per bulan dan per GL itu karangan.** Jangan dipakai buat keputusan sampai diganti export asli.

### Butuh jawaban klien

| # | Butir | Sementara pakai |
|---|---|---|
| **C-05** | Ambang warna %Ach. Tangkapan layar: 96,51% ijo, 58,07% oranye, 20,51% merah. Angka potongnya gak ada di dokumen | ≥95 / 60–94 / <60 |
| **C-06** | Tarif kontrak beda sama `Revenue_Data`. CUST-001: 22.000.000 vs 12.500.000. CUST-002: 18.500.000 vs 31.000.000 | Kontrak yang menang |
| **C-07** | Satuan Cargo beda. K-009 nulis 11.200.000, Revenue_Data nulis 4.500 buat ServiceType yang sama. Kayaknya per-kg vs per-bulan | Belum dipetakan |
| **C-08** | CUST-010 s/d 020 cuma muncul di `Revenue_Data`, tanpa nama, kontrak, CRM, atau piutang | Diabaikan |
| **C-09** | `ContractID` bukan kunci unik. K-010 muncul 2× (CGK dan DPS, tarif beda) | Kunci = (ContractID + Station) |
| **C-10** | Header antar sheet gak konsisten. GH/CGO nulis `HPP/Handling`, OB nulis `Cost/Handling` | Dipetakan ke satu kolom `cost` |
| **C-11** | Kosakata LoB gak nyambung. Tangkapan layar: SAFAR/GPL/GLC/JOUMPA. Contoh baris docx: LOGISTIK/OTHER BUSINESS/OB REVENUE | `group 1 GL` dianggap LoB |
| **C-12** | Peran OS KPS. Matriks cuma nulis "akses sesuai pembagian peran OP/OS/OCS" tanpa jabarin | Baca kontrak dan penalty |
| **C-13** | Akun pencatatan biaya klaim penalty masih kecampur beban lain. Urusan akuntansi, di luar sistem, tapi bikin angka penalty gak bisa dipercaya penuh | Ditampilkan apa adanya |
| **C-14** | Power BI gak bisa diverifikasi — kekunci login tenant Microsoft Gapura. Rumus dasar udah diturunkan dari tangkapan layar dan cocok, definisi turunan lain gak ketebak | Rumus di bagian 10 |
| **C-17** | ~~Kolom Agent / Non-Agent~~ **TERJAWAB.** Sheet punya kolom `Customer Type`, pull menyimpannya di `customers.tipe`, 33/33 pelanggan terisi. Pemisah B2B/B2C membaca kolom itu (`inSegmen`) — tebakan dari `group 2 GL` (CORE vs OTHER BUSINESS) sudah dibuang karena menaruh maskapai di sisi konsumen (audit D-4) | Pelanggan tanpa jawaban muncul di kedua-dua papan tidak sama sekali; null = belum disebut Sheet |
| **C-18** | Ambang **status hidup** pelanggan. Tracker menampilkan Active / Risk / Dormant / Lost di samping kolom *Last Transaction (Day)*, tanpa menyebut angka potongnya di dokumen manapun | Active ≤ 45 hari · Risk ≤ 90 · Dormant ≤ 180 · Lost di atas itu |
| **C-19** | Tingkat **HUB** di Decomposition Tree. Tracker menaruhnya antara LoB dan Airport — CGK (1), DPS (2), SUB (4), KNO (5), UPG (3) — mengelompokkan beberapa bandara di bawah satu hub. Pengelompokan itu gak ada di Sheet maupun tabel `cabang` | Tingkat HUB dilewati |
| **C-15** | Header `Penalty_Data` itu **karangan kita**. Tab-nya kosong tanpa baris header sama sekali, jadi nama kolomnya diturunkan dari tabel `penalties` di bagian 7.2: `CustomerID · PenaltyDescription · PenaltyValue · Station · Stage · ReportedDate`. Klien belum pernah lihat, apalagi setuju | Header di atas |

---

## 16. Lampiran

### 16.1 Inventaris sumber

| Sumber | Isi | Status |
|---|---|---|
| Commercial Web & Application Requirement.xlsx | Feature Requirement (4 domain, 12 request) + User Access Matrix (8 role) | Kebaca |
| COMMERSIL.docx | Peta menu, entitas sheet, header `Ancillary_Data` | Kebaca |
| Commercial_Contract_GH | 9 kontrak Ground Handling | Kebaca |
| Commercial_Contract_Cargo | 1 kontrak Cargo | Kebaca |
| Commercial_Contract_Ancillary | 2 kontrak Ancillary | Kebaca |
| CRM_Master | 9 customer, RFM + skor | Kebaca |
| AR_Receivables | 9 customer, 8 bucket aging | Kebaca |
| OCS Irregularities | 10 kasus. *Gak terdaftar di xlsx* — ketemu dari tab `Link Data` | Kebaca |
| Master_Database_Komersial_Compiled | 8 tab, database utama | Kebaca |
| Detail Notes Analisa Kebutuhan | Versi live dari xlsx — isinya identik | Kebaca |
| Power BI — Pendapatan (`7832b105`) | 6 dashboard referensi | **Login tenant** |
| Power BI — Kontrak (`d6696042`) | Dashboard kontrak | **Login tenant** |
| Figma prototype | Rujukan visual, versi sebelumnya | Kebaca |
| oneclick-commercial.vercel.app | Web yang jalan sekarang | Kebaca |
| gapura-oneclick.vercel.app | Web Irregularities OCS | Terdaftar, belum ditelusuri |

### 16.2 Data kontrak yang ada sekarang

| ID | Customer | Station | LoB | Berakhir | Tarif | Cost |
|---|---|---|---|---|---:|---:|
| K-001 | Garuda Indonesia | All Station | Ground Handling | 2026-09-15 | 22.000.000 | 17.000.000 |
| K-002 | Citilink | All Station | Ground Handling | 2026-08-30 | 18.500.000 | 14.800.000 |
| K-003 | Pelita Air | All Station | Ground Handling | 2026-10-12 | 16.000.000 | 12.400.000 |
| K-004 | Asia Flight Service | MDC, BTH | Ground Handling | 2026-07-25 | 9.800.000 | 8.100.000 |
| K-005 | Batik Air | All Station | Ground Handling | 2026-11-05 | 10.500.000 | 8.200.000 |
| K-006 | Batik Air | UPG, SUB | Ground Handling | 2026-08-15 | 13.800.000 | 11.500.000 |
| K-007 | DPR RI | All Station | Ancillary Business | 2026-12-15 | 7.500.000 | 6.000.000 |
| K-008 | Jogja Flight | CGK | Ancillary Business | 2026-12-15 | 5.200.000 | 4.000.000 |
| K-009 | Garuda Indonesia | CGK, SUB | Cargo Handling | 2026-12-15 | 11.200.000 | 9.000.000 |
| K-010 | Airnesia | CGK | Ground Handling | 2026-09-01 | 14.000.000 | 11.200.000 |
| K-010 | Airnesia | DPS | Ground Handling | 2026-09-01 | 12.500.000 | 10.000.000 |
| K-011 | Super Air Jet | All Station | Ground Handling | 2026-10-01 | 13.000.000 | 10.400.000 |

### 16.3 Piutang yang ada sekarang

| Customer | Status | 0-30 | 31-60 | 61-90 | 91-120 | 121-150 | 151-180 | 181-360 | >360 | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Garuda Indonesia | OPEN | 316.800.000 | 500.000 | 0 | 720.000 | 0 | 0 | 0 | 500.000.000 | 818.020.000 |
| Citilink | CLOSED | 0 | 0 | 0 | 6.000.000 | 0 | 0 | 0 | 0 | 6.000.000 |
| Pelita Air | OPEN | 316.800.000 | 500.000 | 0 | 720.000 | 0 | 0 | 0 | 500.000.000 | 818.020.000 |
| Asia Flight Service | CLOSED | 0 | 0 | 720.000 | 0 | 0 | 0 | 0 | 0 | 720.000 |
| Batik Air | CLOSED | 316.800.000 | 500.000 | 0 | 0 | 500.000.000 | 0 | 0 | 720.000 | 818.020.000 |
| Airnesia | CLOSED | 0 | 0 | 500.000.000 | 6.000.000 | 0 | 0 | 0 | 0 | 506.000.000 |
| Super Air Jet | OPEN | 6.000.000 | 316.800.000 | 500.000 | 0 | 0 | 500.000.000 | 0 | 316.800.000 | 1.140.100.000 |
| DPR RI | CLOSED | 0 | 0 | 0 | 6.000.000 | 0 | 0 | 0 | 0 | 6.000.000 |
| Jogja Flight | CLOSED | 500.000.000 | 0 | 0 | 6.000.000 | 0 | 0 | 0 | 0 | 506.000.000 |

### 16.4 Segmentasi CRM

| Customer | RFM | Frequency | Monetary | Recency |
|---|---|---:|---:|---:|
| Garuda Indonesia | MEDIUM | 2 | 3 | 3 |
| Citilink | LOW | 1 | 1 | 1 |
| Pelita Air | HIGH | 3 | 3 | 3 |
| Asia Flight Service | HIGH | 3 | 3 | 3 |
| Batik Air | LOW | 1 | 1 | 1 |
| Airnesia | HIGH | 3 | 3 | 3 |
| Super Air Jet | LOW | 1 | 1 | 1 |
| DPR RI | HIGH | 3 | 3 | 3 |
| Jogja Flight | MEDIUM | 3 | 3 | 2 |

---

*Disusun dari xlsx requirement, COMMERSIL.docx, 7 Google Sheet, 6 tangkapan Power BI, dan skema Supabase yang jalan. Angka di bagian 10 diverifikasi ulang terhadap tangkapan layar. Butir C-05 sampai C-14 belum final.*
