import { ExternalLink, Download, Wallet } from 'lucide-react'

import { ReceivableTable } from '@/app/(app)/piutang/receivable-table'
import { Freshness } from '@/components/freshness'
import { StatCard } from '@/components/dashboard/stat-card'
import { EmptyState } from '@/components/ui/states'
import { may, requireGrant, scopeLabel } from '@/lib/auth'
import { listReceivables, reportLinkFor, totalReceivable } from '@/lib/data/domains'
import { formatRupiahCompact } from '@/lib/domain'

export const metadata = { title: 'Piutang — Gapura Commercial' }

export default async function PiutangPage() {
  const { profile, grants } = await requireGrant('piutang', 'view')
  const [rows, link] = await Promise.all([listReceivables(), reportLinkFor('piutang')])

  if (rows.length === 0) {
    return (
      <EmptyState
        judul="Belum ada piutang dalam cakupan Anda"
        keterangan={`Tidak ada baris Receivable_Data untuk ${scopeLabel(profile)}.`}
      />
    )
  }

  const total = totalReceivable(rows)
  const terbuka = rows.filter((row) => row.status === 'OPEN')
  // The Sheet keeps its own total beside the buckets. Where the two disagree it is a
  // fact about the source, so it is surfaced rather than smoothed over.
  const berbeda = rows.filter((row) => row.total !== row.jumlahBucket)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Piutang</h1>
          <p className="mt-1 text-sm text-gray-400">
            Aging receivable per pelanggan untuk {scopeLabel(profile)}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {may(grants, 'piutang', 'export') ? (
            <a
              href="/api/export/piutang"
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

      <Freshness tab="Receivable_Data" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Akumulasi piutang"
          value={formatRupiahCompact(total)}
          keterangan={`${rows.length} pelanggan`}
          icon={Wallet}
        />
        <StatCard
          label="Masih terbuka"
          value={String(terbuka.length)}
          keterangan={formatRupiahCompact(totalReceivable(terbuka))}
          icon={Wallet}
          tone={terbuka.length > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="Umur > 360 hari"
          value={formatRupiahCompact(rows.reduce((sum, row) => sum + row.buckets.d360_plus, 0))}
          keterangan="Bucket tertua"
          icon={Wallet}
          tone="bad"
        />
      </div>

      {berbeda.length > 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-sem-warn">
          {berbeda.length} baris punya kolom Total yang tidak sama dengan jumlah bucket-nya di
          Sheet. Yang ditampilkan adalah Total milik Sheet, apa adanya.
        </p>
      ) : null}

      <ReceivableTable rows={rows} total={total} />
    </div>
  )
}
