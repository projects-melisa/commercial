import { Settings, ShieldCheck } from 'lucide-react'

import { ReportLinksManager, type ReportLinkRow } from '@/app/(app)/pengaturan/report-links-form'
import { may, requireCaller, scopeLabel } from '@/lib/auth'
import { listContracts } from '@/lib/data/contracts'
import { listReceivables, listReportLinks } from '@/lib/data/domains'
import { getLastSheetSync } from '@/lib/data/notifications'
import { formatPercent, REMINDER_MILESTONES, ROLE_LABELS } from '@/lib/domain'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export const metadata = { title: 'Pengaturan — Gapura Commercial' }

/**
 * U-10 · every mismatch the code already knows about, on one screen.
 *
 * Each of these facts is computed somewhere and shown nowhere — the Sheet's own total
 * against the sum of its buckets (C-06 lives in the same family), customers the revenue
 * tab names but CRM has never heard of (CUST-010…013), and pull runs that failed or
 * never happened. Nothing here fixes anything; a reconciliation page that repaired as
 * it went would be a second source of truth.
 */
const Rekonsiliasi = async () => {
  const supabase = await createClient()

  const [piutang, pelanggan, pendapatan, syncs] = await Promise.all([
    listReceivables(),
    supabase.from('customers').select('customer_id'),
    supabase.from('ancillary_revenues').select('customer'),
    supabase.from('sheet_syncs').select('tab, status, finished_at').order('finished_at', { ascending: false }),
  ])

  const totalVsBucket = piutang.filter((row) => row.total !== row.jumlahBucket)

  const dikenal = new Set((pelanggan.data ?? []).map((row) => row.customer_id))
  const yatim = [
    ...new Set(
      (pendapatan.data ?? [])
        .map((row) => row.customer)
        .filter((nama) => !dikenal.has(nama)),
    ),
  ]

  const terakhir = new Map<string, { tab: string | null; status: string; finished_at: string }>()
  for (const row of syncs.data ?? []) {
    if (!terakhir.has(row.tab ?? '')) terakhir.set(row.tab ?? '', row)
  }
  const gagal = [...terakhir.entries()].filter(([, v]) => v.status !== 'ok' && v.tab !== '')

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-bold text-gray-900">Rekonsiliasi Sheet ↔ Web</h2>
      <p className="mb-4 text-xs text-gray-500">
        Ketidakcocokan yang sudah diketahui kode dan kini ditampilkan. Semuanya pulih di
        Google Sheet — sumber kebenaran — bukan di sini.
      </p>
      <ul className="space-y-2 text-sm">
        <li className="flex flex-wrap items-baseline gap-2">
          <span className={totalVsBucket.length > 0 ? 'font-semibold text-sem-warn' : 'text-gray-500'}>
            {totalVsBucket.length === 0
              ? '✓ Total piutang cocok dengan jumlah bucket di semua baris.'
              : `${totalVsBucket.length} baris piutang punya kolom Total ≠ jumlah bucket:`}
          </span>
          {totalVsBucket.map((row) => (
            <span key={row.customerId} className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600">
              {row.customerNama} ({row.jumlahBucket} vs {row.total})
            </span>
          ))}
        </li>
        <li className="flex flex-wrap items-baseline gap-2">
          <span className={yatim.length > 0 ? 'font-semibold text-sem-warn' : 'text-gray-500'}>
            {yatim.length === 0
              ? '✓ Semua pelanggan di Ancillary_Data terdaftar di CRM.'
              : `Pelanggan yatim — ada di pendapatan, tidak ada di CRM_Data (C-08):`}
          </span>
          {yatim.map((nama) => (
            <span key={nama} className="rounded bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600">
              {nama}
            </span>
          ))}
        </li>
        <li className="flex flex-wrap items-baseline gap-2">
          <span className={gagal.length > 0 ? 'font-semibold text-sem-bad' : 'text-gray-500'}>
            {gagal.length === 0
              ? '✓ Tarikan per tab semuanya berhasil pada run terakhir masing-masing.'
              : `Tarikan terakhir GAGAL untuk ${gagal.length} tab:`}
          </span>
          {gagal.map(([tabName, v]) => (
            <span key={tabName} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-gray-600">
              {tabName || '(tanpa tab)'} ·{' '}
              {new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(v.finished_at))}
            </span>
          ))}
        </li>
      </ul>
    </section>
  )
}

type AppModule = Database['public']['Enums']['app_module']

// Every module a Power BI report could plausibly exist for. `pengguna` and
// `report_links` manage access, not report content, so neither gets a row here.
const REPORT_MODULES: readonly { modul: AppModule; label: string }[] = [
  { modul: 'kontrak', label: 'Kontrak' },
  { modul: 'crm', label: 'Pelanggan' },
  { modul: 'simulator', label: 'Simulator P&L' },
  { modul: 'pendapatan', label: 'Pendapatan' },
  { modul: 'piutang', label: 'Piutang' },
  { modul: 'penalty', label: 'Penalty' },
  { modul: 'irregularities', label: 'Irregularities' },
  { modul: 'notifikasi', label: 'Notifikasi' },
]

const BANDS = [
  { band: 'Nonaktif', rule: 'Sudah melewati tanggal berakhir' },
  { band: 'Kritis', rule: '0 sampai 14 hari tersisa' },
  { band: 'Perlu Perhatian', rule: '15 sampai 60 hari tersisa' },
  { band: 'Aman', rule: 'Lebih dari 60 hari tersisa' },
]

export default async function PengaturanPage() {
  const { profile, grants } = await requireCaller()
  const contracts = await listContracts()
  const lastSync = await getLastSheetSync()
  const canManageLinks = may(grants, 'report_links', 'manage')
  const existingLinks = canManageLinks ? await listReportLinks() : []

  // The most recent change to any contract the caller can see — how current the
  // figures on screen actually are.
  const lastUpdated = contracts.reduce<string | null>(
    (latest, contract) =>
      latest === null || contract.updatedAt > latest ? contract.updatedAt : latest,
    null,
  )

  // Only the targets that actually exist. Contracts without one are counted
  // separately rather than appearing as a phantom band.
  const targets = [...new Set(contracts.map((c) => c.minGpmTarget))]
    .filter((target): target is number => target !== null)
    .sort((a, b) => a - b)
  const withoutTarget = contracts.filter((c) => c.minGpmTarget === null).length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 sm:text-2xl">
          <Settings className="text-primary" size={22} aria-hidden="true" />
          Pengaturan
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Identitas Anda dan aturan yang sedang berlaku di sistem ini.
        </p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-gray-900">Profil &amp; Hak Akses</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Nama</dt>
            <dd className="mt-1 font-semibold text-gray-900">{profile.nama}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Peran</dt>
            <dd className="mt-1 font-semibold text-gray-900">{ROLE_LABELS[profile.role]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Cakupan</dt>
            <dd className="mt-1 font-semibold text-gray-900">{scopeLabel(profile)}</dd>
          </div>
        </dl>

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          Cakupan ini ditegakkan oleh kebijakan row-level security di basis data, bukan
          oleh tampilan. Kontrak di luar cakupan Anda tidak dikirimkan ke sesi ini
          sama sekali — {contracts.length} kontrak terlihat oleh akun Anda.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">Ambang Status Kontrak</h2>
          <p className="mb-4 text-xs text-gray-500">
            Sejajar dengan milestone reminder, sehingga badge dan email tidak pernah
            bertentangan.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-500">
              <tr>
                <th scope="col" className="pb-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Aturan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {BANDS.map(({ band, rule }) => (
                <tr key={band}>
                  <th scope="row" className="py-2 font-semibold text-gray-900">
                    {band}
                  </th>
                  <td className="py-2 text-gray-600">{rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">Milestone Reminder</h2>
          <p className="mb-4 text-xs text-gray-500">
            Reminder dikirim otomatis setiap hari melalui pg_cron, dan dapat dipicu
            manual dari halaman Kontrak Kritis. Keduanya memanggil fungsi yang sama.
          </p>
          <ul className="flex flex-wrap gap-2">
            {REMINDER_MILESTONES.map((milestone) => (
              <li
                key={milestone}
                className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-bold text-primary"
              >
                H-{milestone}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            Satu reminder per kontrak per milestone — pengiriman ulang tidak menghasilkan
            notifikasi ganda.
          </p>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-bold text-gray-900">Target Margin</h2>
        <p className="mb-4 text-xs text-gray-500">
          Target margin ditetapkan <strong>per kontrak</strong>, bukan satu ambang global.{' '}
          {targets.length === 0
            ? 'Belum ada kontrak dalam cakupan Anda yang memiliki target — sumber data belum mencantumkannya.'
            : `Nilai yang berlaku pada cakupan Anda berkisar ${formatPercent(targets[0]!, 0)} sampai ${formatPercent(targets[targets.length - 1]!, 0)}.`}
        </p>
        <ul className="flex flex-wrap gap-2">
          {targets.map((target) => (
            <li
              key={target}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700"
            >
              {formatPercent(target, 0)}
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                {contracts.filter((c) => c.minGpmTarget === target).length} kontrak
              </span>
            </li>
          ))}
          {withoutTarget > 0 ? (
            <li className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-500">
              Tanpa target
              <span className="ml-1.5 text-xs font-normal text-gray-400">
                {withoutTarget} kontrak
              </span>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-bold text-gray-900">Sumber Data</h2>
        <p className="text-xs text-gray-500">
          Diimpor dari <code>Master_Database_Komersial_Compiled.xlsx</code> — 20 kontrak,
          20 pelanggan, 10 kasus layanan. Tanggal berakhir disimpan sebagai offset dari
          tanggal impor agar pipeline perpanjangan tetap terisi, dengan tanggal asli
          disimpan pada kolom <code>source_end_date</code>.
        </p>
        <div className="mt-3 rounded-lg border border-gray-200 px-3 py-2.5">
          <p className="text-xs font-semibold text-gray-700">Tarikan Google Sheets</p>
          {lastSync === null ? (
            <p className="mt-0.5 text-xs text-gray-500">
              Belum pernah ditarik. Angka di layar mungkin belum mencerminkan Sheet terbaru.
            </p>
          ) : (
            <p
              className={`mt-0.5 text-xs ${
                lastSync.status === 'ok' ? 'text-gray-500' : 'font-semibold text-red-700'
              }`}
            >
              {lastSync.status === 'ok'
                ? `Berhasil — ${lastSync.rows_written} baris pada `
                : `GAGAL pada `}
              {new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: 'Asia/Jakarta',
              }).format(new Date(lastSync.finished_at))}{' '}
              WIB ({lastSync.trigger === 'schedule' ? 'terjadwal' : 'manual'}).
              {lastSync.error ? ` ${lastSync.error}` : ''}
            </p>
          )}
        </div>

        {lastUpdated ? (
          <p className="mt-2 text-xs text-gray-500">
            Perubahan data terakhir:{' '}
            <strong>
              {new Intl.DateTimeFormat('id-ID', {
                dateStyle: 'long',
                timeStyle: 'short',
                timeZone: 'Asia/Jakarta',
              }).format(new Date(lastUpdated))}
            </strong>{' '}
            WIB.
          </p>
        ) : null}
      </section>

      {may(grants, 'keputusan', 'input') || may(grants, 'pengguna', 'manage') ? (
        <Rekonsiliasi />
      ) : null}

      {canManageLinks ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">Tautan Eksternal (Power BI)</h2>
          <p className="mb-4 text-xs text-gray-500">
            Tombol keluar per modul, bukan iframe tertanam — URL embed membawa tenant
            Microsoft klien, dan siapa pun di luar tenant itu akan melihat formulir login
            Microsoft di tengah halaman. Perubahan di sini langsung berlaku untuk semua
            role yang memegang <code>view</code> pada modul terkait.
          </p>
          <ReportLinksManager
            rows={REPORT_MODULES.map(
              ({ modul, label }): ReportLinkRow => ({
                modul,
                label,
                judul: existingLinks.find((l) => l.modul === modul)?.judul ?? `Dashboard ${label}`,
                url: existingLinks.find((l) => l.modul === modul)?.url ?? '',
                aktif: existingLinks.find((l) => l.modul === modul)?.aktif ?? false,
              }),
            )}
          />
        </section>
      ) : null}
    </div>
  )
}
