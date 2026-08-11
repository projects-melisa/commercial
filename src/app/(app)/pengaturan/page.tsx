import { Settings, ShieldCheck } from 'lucide-react'

import { requireProfile } from '@/lib/auth'
import { listContracts } from '@/lib/data/contracts'
import { getLastSheetSync } from '@/lib/data/notifications'
import { formatPercent, REMINDER_MILESTONES } from '@/lib/domain'

export const metadata = { title: 'Pengaturan — G-CME' }

const BANDS = [
  { band: 'Nonaktif', rule: 'Sudah melewati tanggal berakhir' },
  { band: 'Kritis', rule: '0 sampai 14 hari tersisa' },
  { band: 'Perlu Perhatian', rule: '15 sampai 60 hari tersisa' },
  { band: 'Aman', rule: 'Lebih dari 60 hari tersisa' },
]

export default async function PengaturanPage() {
  const profile = await requireProfile()
  const contracts = await listContracts()
  const lastSync = await getLastSheetSync()

  // The most recent change to any contract the caller can see — how current the
  // figures on screen actually are.
  const lastUpdated = contracts.reduce<string | null>(
    (latest, contract) =>
      latest === null || contract.updatedAt > latest ? contract.updatedAt : latest,
    null,
  )

  const targets = [...new Set(contracts.map((c) => c.minGpmTarget))].sort((a, b) => a - b)

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
            <dd className="mt-1 font-semibold text-gray-900">
              {profile.role === 'vp' ? 'VP / Dirut DC' : 'Commercial'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-gray-500 uppercase">Lini Bisnis</dt>
            <dd className="mt-1 font-semibold text-gray-900">
              {profile.business_line ?? 'Seluruh lini bisnis'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          Cakupan ini ditegakkan oleh kebijakan row-level security di basis data, bukan
          oleh tampilan. Kontrak di luar lini bisnis Anda tidak dikirimkan ke sesi ini
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
          Target margin ditetapkan <strong>per kontrak</strong>, bukan satu ambang global.
          Nilai yang berlaku pada cakupan Anda berkisar {formatPercent(targets[0] ?? 0, 0)}
          {' '}sampai {formatPercent(targets[targets.length - 1] ?? 0, 0)}.
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
          <p className="text-xs font-semibold text-gray-700">Cermin Google Sheets</p>
          {lastSync === null ? (
            <p className="mt-0.5 text-xs text-gray-500">
              Belum pernah disinkronkan. Sheet mungkin belum mencerminkan data terbaru.
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
    </div>
  )
}
