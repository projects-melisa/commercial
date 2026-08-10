'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'

import { saveScenario, submitScenario } from '@/app/(app)/simulator/[id]/actions'
import { Simulator } from '@/components/simulator/simulator'
import type { ContractView } from '@/lib/data/contracts'
import type { ScenarioView } from '@/lib/data/scenarios'
import { formatPercent, formatRupiah, meetsTarget } from '@/lib/domain'

const STATUS_LABEL = {
  draft: { text: 'Draft', className: 'bg-gray-100 text-gray-700' },
  pending: { text: 'Menunggu persetujuan', className: 'bg-amber-100 text-amber-800' },
  approved: { text: 'Disetujui', className: 'bg-green-100 text-green-800' },
  rejected: { text: 'Ditolak', className: 'bg-red-100 text-red-800' },
} as const

export const SimulatorPanel = ({
  contract,
  scenarios,
  canAuthor,
}: {
  contract: ContractView
  scenarios: ScenarioView[]
  canAuthor: boolean
}) => {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ error: string | null; message: string | null }>({
    error: null,
    message: null,
  })

  const handleSave = (nama: string, tarif: number, cost: number) => {
    const formData = new FormData()
    formData.set('contract_id', contract.id)
    formData.set('nama', nama)
    formData.set('proposed_tarif', String(tarif))
    formData.set('proposed_cost', String(cost))

    startTransition(async () => {
      setFeedback(await saveScenario({ error: null, message: null }, formData))
    })
  }

  const handleSubmit = (scenarioId: string) => {
    const formData = new FormData()
    formData.set('scenario_id', scenarioId)
    formData.set('contract_id', contract.id)

    startTransition(async () => {
      setFeedback(await submitScenario({ error: null, message: null }, formData))
    })
  }

  return (
    <div className="space-y-5">
      <Simulator
        contract={contract}
        onSave={canAuthor ? handleSave : undefined}
        saving={pending}
      />

      {feedback.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {feedback.error}
        </p>
      ) : null}
      {feedback.message ? (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {feedback.message}
        </p>
      ) : null}

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-bold text-gray-900">Skenario Tersimpan</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Skenario yang disimpan terhadap kontrak ini, beserta status persetujuannya.
          </p>
        </div>

        {scenarios.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            Belum ada skenario tersimpan untuk kontrak ini.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {scenarios.map((scenario) => {
              const label = STATUS_LABEL[scenario.status]
              const scenarioGpm = Number(scenario.gpm)
              const meets = meetsTarget(scenarioGpm, contract.minGpmTarget)
              return (
                <li key={scenario.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{scenario.nama}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Tarif {formatRupiah(Number(scenario.proposed_tarif))} · Cost{' '}
                      {formatRupiah(Number(scenario.proposed_cost))} · GPM{' '}
                      <span className={meets ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
                        {formatPercent(scenarioGpm)}
                      </span>{' '}
                      terhadap target {formatPercent(contract.minGpmTarget)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">oleh {scenario.authorName}</p>
                    {scenario.status === 'rejected' && scenario.rejection_reason ? (
                      <p className="mt-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
                        Alasan penolakan: {scenario.rejection_reason}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${label.className}`}
                  >
                    {label.text}
                  </span>

                  {canAuthor && scenario.status === 'draft' ? (
                    <button
                      type="button"
                      onClick={() => handleSubmit(scenario.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-light disabled:opacity-50"
                    >
                      <Send size={13} aria-hidden="true" />
                      Ajukan
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
