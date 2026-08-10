'use client'

import { useActionState, useId, useState } from 'react'
import { Check, X } from 'lucide-react'

import { decideScenario, type ScenarioActionState } from '@/app/(app)/simulator/[id]/actions'

export const DecisionForm = ({ scenarioId }: { scenarioId: string }) => {
  const [state, formAction, pending] = useActionState<ScenarioActionState, FormData>(
    decideScenario,
    { error: null, message: null },
  )
  const [rejecting, setRejecting] = useState(false)
  const reasonId = useId()

  return (
    <form action={formAction} className="mt-4 border-t border-gray-100 pt-4">
      <input type="hidden" name="scenario_id" value={scenarioId} />

      {rejecting ? (
        <div className="mb-3">
          <label htmlFor={reasonId} className="mb-1.5 block text-xs font-semibold text-gray-700">
            Alasan penolakan (wajib)
          </label>
          <textarea
            id={reasonId}
            name="rejection_reason"
            rows={2}
            required
            placeholder="Jelaskan mengapa usulan ini ditolak, agar Commercial memahami alasannya."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <button
              type="submit"
              name="decision"
              value="rejected"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <X size={15} aria-hidden="true" />
              Konfirmasi Penolakan
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              name="decision"
              value="approved"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-50"
            >
              <Check size={15} aria-hidden="true" />
              Setujui
            </button>
            <button
              type="button"
              onClick={() => setRejecting(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              <X size={15} aria-hidden="true" />
              Tolak
            </button>
          </>
        )}
      </div>

      {state.error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
