import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { CaseTable } from '@/app/(app)/irregularities/case-table'
import { StatCard } from '@/components/dashboard/stat-card'
import { EmptyState } from '@/components/ui/states'
import { requireGrant } from '@/lib/auth'
import { listIrregularities } from '@/lib/data/domains'

export const metadata = { title: 'Irregularities — Gapura Commercial' }

/**
 * OCS only, to read as well as to write.
 *
 * This is the one module with a single holder, and it is a deliberate cost rather than
 * an oversight: requirement 1.0 names Irregularities as one of the units Commercial
 * currently has to chase by hand, and locking it here means the renewal decision can
 * no longer see "this customer has two open cases". Recorded as R-01.
 */
export default async function IrregularitiesPage() {
  await requireGrant('irregularities', 'view')
  const rows = await listIrregularities()

  if (rows.length === 0) {
    return (
      <EmptyState
        judul="Belum ada kasus tercatat"
        keterangan="Irregularities diinput di Sheet OCS dan masuk lewat tarikan harian."
      />
    )
  }

  const open = rows.filter((row) => row.status === 'OPEN')

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-900">Irregularities</h1>
        <p className="mt-1 text-sm text-gray-400">
          Kasus layanan per pelanggan. Modul ini hanya terbuka untuk OCS KPS — peran lain tidak
          menerima satu baris pun, dan halaman ini menjawab 404 bagi mereka.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total kasus" value={String(rows.length)} icon={AlertTriangle} />
        <StatCard
          label="Terbuka"
          value={String(open.length)}
          icon={AlertTriangle}
          tone={open.length > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="Ditutup"
          value={String(rows.length - open.length)}
          icon={CheckCircle2}
          tone="good"
        />
      </div>

      <CaseTable rows={rows} />
    </div>
  )
}
