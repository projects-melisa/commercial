'use client'

import { useActionState } from 'react'

import { recordKeputusan, type KeputusanState } from './keputusan-actions'

const EMPTY: KeputusanState = { error: null, ok: null }

const LABELS: Record<string, string> = {
  renew: 'Perpanjang',
  no_renew: 'Berhenti',
  renegosiasi: 'Renegosiasi',
}

/** The decision, in the caller's own words plus one of three boxes. Nothing smarter. */
export const KeputusanForm = ({ contractId }: { contractId: string }) => {
  const [state, action, pending] = useActionState(recordKeputusan, EMPTY)

  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-start">
      <input type="hidden" name="contract_id" value={contractId} />
      <select
        name="keputusan"
        required
        defaultValue="renew"
        aria-label="Keputusan"
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      >
        {Object.entries(LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        name="alasan"
        required
        placeholder="Alasan (wajib)"
        aria-label="Alasan"
        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
      >
        {pending ? 'Menyimpan…' : 'Catat'}
      </button>
      {state.error !== null || state.ok !== null ? (
        <p
          role="alert"
          className={`text-xs sm:col-span-3 ${
            state.error ? 'font-semibold text-sem-bad' : 'text-sem-ok'
          }`}
        >
          {state.error ?? state.ok}
        </p>
      ) : null}
    </form>
  )
}
