import Link from 'next/link'
import { TrendingUp } from 'lucide-react'

import { GpmIndicator, StatusBadge } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/states'
import { listContracts } from '@/lib/data/contracts'
import { formatPercent, formatRupiahCompact } from '@/lib/domain'

export const metadata = { title: 'Simulator P&L — G-CME' }

export default async function SimulatorIndexPage() {
  const contracts = await listContracts()

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Simulator P&amp;L</h1>
        <p className="mt-1 text-sm text-gray-500">
          Pilih kontrak untuk mensimulasikan tarif dan cost terhadap target marginnya sendiri.
        </p>
      </header>

      {contracts.length === 0 ? (
        <EmptyState
          judul="Belum ada kontrak untuk disimulasikan"
          keterangan="Tidak ada kontrak dalam cakupan akses Anda."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <Link
                href={`/simulator/${contract.id}`}
                className="card-hover block h-full rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-900">{contract.customerName}</p>
                  <TrendingUp size={16} className="shrink-0 text-primary" aria-hidden="true" />
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  {contract.businessLine} · {contract.serviceType}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={contract.status} />
                  <GpmIndicator margin={contract.margin} />
                </div>
                <p className="mt-2.5 text-xs text-gray-500">
                  Tarif {formatRupiahCompact(contract.tarif)} · target{' '}
                  {formatPercent(contract.minGpmTarget, 0)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
