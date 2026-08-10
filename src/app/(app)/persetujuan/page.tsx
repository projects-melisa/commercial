import { redirect } from 'next/navigation'
import { CheckSquare } from 'lucide-react'

import { DecisionForm } from '@/app/(app)/persetujuan/decision-form'
import { EmptyState } from '@/components/ui/states'
import { requireProfile } from '@/lib/auth'
import { listPendingScenarios } from '@/lib/data/scenarios'
import {
  formatPercent,
  formatPercentagePoints,
  formatRupiah,
  gpm,
  meetsTarget,
} from '@/lib/domain'

export const metadata = { title: 'Persetujuan — G-CME' }

export default async function PersetujuanPage({
  searchParams,
}: {
  searchParams: Promise<{ keputusan?: string }>
}) {
  const profile = await requireProfile()
  // Approval is the VP's alone; the decision policy would refuse anyone else anyway.
  if (profile.role !== 'vp') redirect('/')

  const { keputusan } = await searchParams
  const scenarios = await listPendingScenarios()

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 sm:text-2xl">
          <CheckSquare className="text-primary" size={22} aria-hidden="true" />
          Antrean Persetujuan
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {scenarios.length} skenario menunggu keputusan Anda.
        </p>
      </header>

      {keputusan === 'approved' || keputusan === 'rejected' ? (
        <p
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            keputusan === 'approved'
              ? 'bg-green-50 text-green-800'
              : 'bg-amber-50 text-amber-900'
          }`}
        >
          {keputusan === 'approved'
            ? 'Skenario disetujui. Commercial telah diberi tahu.'
            : 'Skenario ditolak. Commercial telah diberi tahu beserta alasannya.'}
        </p>
      ) : null}

      {scenarios.length === 0 ? (
        <EmptyState
          judul="Tidak ada skenario menunggu keputusan"
          keterangan="Semua skenario yang diajukan sudah diputuskan. Anda akan diberi tahu ketika ada pengajuan baru."
        />
      ) : (
        <ul className="space-y-4">
          {scenarios.map((scenario) => {
            const proposedGpm = Number(scenario.gpm)
            const currentGpm = gpm(scenario.contract.tarif, scenario.contract.cost)
            const target = scenario.contract.minGpmTarget
            const meets = meetsTarget(proposedGpm, target)

            return (
              <li
                key={scenario.id}
                className="rounded-xl border border-gray-200 bg-white p-5"
              >
                <div className="mb-4">
                  <h2 className="font-bold text-gray-900">{scenario.nama}</h2>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {scenario.contract.customerName} · {scenario.contract.businessLine} ·
                    diajukan oleh {scenario.authorName}
                  </p>
                </div>

                {/* Proposed against current, and the result against this contract's
                    own target — everything needed to judge the change. */}
                <div className="relative overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-left text-sm">
                    <thead className="text-xs text-gray-500">
                      <tr>
                        <th scope="col" className="pb-2 font-semibold" />
                        <th scope="col" className="pb-2 font-semibold">
                          Saat Ini
                        </th>
                        <th scope="col" className="pb-2 font-semibold">
                          Usulan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <th scope="row" className="py-2 font-medium text-gray-600">
                          Tarif
                        </th>
                        <td className="py-2 text-gray-700">
                          {formatRupiah(scenario.contract.tarif)}
                        </td>
                        <td className="py-2 font-bold text-gray-900">
                          {formatRupiah(Number(scenario.proposed_tarif))}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-2 font-medium text-gray-600">
                          Cost
                        </th>
                        <td className="py-2 text-gray-700">
                          {formatRupiah(scenario.contract.cost)}
                        </td>
                        <td className="py-2 font-bold text-gray-900">
                          {formatRupiah(Number(scenario.proposed_cost))}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-2 font-medium text-gray-600">
                          GPM
                        </th>
                        <td className="py-2 text-gray-700">{formatPercent(currentGpm)}</td>
                        <td
                          className={`py-2 font-bold ${meets ? 'text-green-700' : 'text-red-700'}`}
                        >
                          {formatPercent(proposedGpm)}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row" className="py-2 font-medium text-gray-600">
                          Terhadap target {formatPercent(target)}
                        </th>
                        <td className="py-2 text-gray-700">
                          {formatPercentagePoints(currentGpm - target)}
                        </td>
                        <td
                          className={`py-2 font-bold ${meets ? 'text-green-700' : 'text-red-700'}`}
                        >
                          {formatPercentagePoints(proposedGpm - target)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p
                  className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                    meets ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {meets
                    ? 'Usulan ini memenuhi target margin kontrak.'
                    : 'Usulan ini berada di bawah target margin kontrak.'}
                </p>

                <DecisionForm scenarioId={scenario.id} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
