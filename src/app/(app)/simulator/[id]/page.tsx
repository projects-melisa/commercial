import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { SimulatorPanel } from '@/app/(app)/simulator/[id]/simulator-panel'
import { StatusBadge } from '@/components/ui/badges'
import { requireProfile } from '@/lib/auth'
import { getContract } from '@/lib/data/contracts'
import { listScenariosForContract } from '@/lib/data/scenarios'
import { formatPercent } from '@/lib/domain'

export const metadata = { title: 'Simulator P&L — G-CME' }

export default async function SimulatorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const profile = await requireProfile()
  const contract = await getContract(id)
  if (!contract) notFound()

  const scenarios = await listScenariosForContract(id)

  return (
    <div className="space-y-5">
      <Link
        href={`/kontrak/${contract.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Kembali ke detail kontrak
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
            Simulator P&amp;L — {contract.customerName}
          </h1>
          <StatusBadge status={contract.status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {contract.businessLine} · {contract.serviceType} · angka kontrak dimuat otomatis,
          target margin kontrak ini {formatPercent(contract.minGpmTarget, 0)}.
        </p>
      </header>

      <SimulatorPanel
        contract={contract}
        scenarios={scenarios}
        // A VP monitors and approves; proposing pricing is Commercial's job, and the
        // insert policy would refuse it regardless of what is shown here.
        canAuthor={profile.role === 'commercial'}
      />
    </div>
  )
}
