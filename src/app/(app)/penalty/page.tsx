import { AlertTriangle, Download, ExternalLink, Gavel } from 'lucide-react'

import { PenaltyTable } from '@/app/(app)/penalty/penalty-table'
import { Freshness } from '@/components/freshness'
import { StatCard } from '@/components/dashboard/stat-card'
import { EmptyState } from '@/components/ui/states'
import { may, requireGrant, scopeLabel } from '@/lib/auth'
import { listPenalties, reportLinkFor } from '@/lib/data/domains'
import { formatRupiahCompact } from '@/lib/domain'

export const metadata = { title: 'Penalty — Gapura Commercial' }

export default async function PenaltyPage() {
  const { profile, grants } = await requireGrant('penalty', 'view')
  const [rows, link] = await Promise.all([listPenalties(), reportLinkFor('penalty')])
  // The station validates its own cases (U-2); who may press is the grant, whose rows
  // is the policy — the button and the write cannot disagree because both read the
  // same table. `dilaporkan` only: validation happens before any later stage exists.
  const bolehValidasi = may(grants, 'penalty', 'input')
  const bisaValidasi = (row: (typeof rows)[number]): boolean =>
    bolehValidasi &&
    row.tahap === 'dilaporkan' &&
    row.divalidasiPada === null &&
    (profile.cabang === null || profile.cabang === row.cabangAsal)

  if (rows.length === 0) {
    return (
      <EmptyState
        judul="Belum ada penalty dalam cakupan Anda"
        keterangan={`Tidak ada baris Penalty_Data untuk ${scopeLabel(profile)}.`}
      />
    )
  }

  const terbuka = rows.filter((row) => row.tahap !== 'ditutup')
  const nilai = rows.reduce((sum, row) => sum + (row.nilai ?? 0), 0)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Penalty</h1>
          <p className="mt-1 text-sm text-gray-400">
            Konsolidasi penalty untuk {scopeLabel(profile)}, beserta tahap validasinya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {may(grants, 'penalty', 'export') ? (
            <a
              href="/api/export/penalty"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download size={15} aria-hidden="true" />
              Ekspor CSV
            </a>
          ) : null}
          {link ? (
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={15} aria-hidden="true" />
            {link.judul}
          </a>
          ) : null}
        </div>
      </header>

      <Freshness tab="Penalty_Data" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total penalty" value={String(rows.length)} icon={Gavel} />
        <StatCard
          label="Belum ditutup"
          value={String(terbuka.length)}
          keterangan="Masih berjalan di salah satu tahap"
          icon={AlertTriangle}
          tone={terbuka.length > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="Nilai tercatat"
          value={formatRupiahCompact(nilai)}
          keterangan="Sebagian akun biaya klaim masih tercampur — C-13"
          icon={Gavel}
        />
      </div>

      <PenaltyTable rows={rows.map((row) => ({ ...row, bisaValidasi: bisaValidasi(row) }))} />

      <p className="text-xs text-gray-400">
        Tahap tidak dipaksa berurutan: dokumen menggambarkan dua jalur — ideal lewat validasi
        cabang, dan nyata lewat Commercial — dan sistem harus menampung keduanya tanpa ada yang
        perlu mengisi langkah yang tidak terjadi.
      </p>
    </div>
  )
}
