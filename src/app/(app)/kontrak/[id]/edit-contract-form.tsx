'use client'

import { useActionState, useId, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertTriangle, Check, Loader2, Pencil, X } from 'lucide-react'

import { updateContract, type EditContractState } from '@/app/(app)/kontrak/[id]/actions'
import type { ContractView } from '@/lib/data/contracts'
import { formatPercent, gpm, meetsTarget, VOLUME_UNITS } from '@/lib/domain'

const SaveButton = () => {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-60"
    >
      {pending ? (
        <Loader2 size={15} className="animate-spin" aria-hidden="true" />
      ) : (
        <Check size={15} aria-hidden="true" />
      )}
      Simpan Perubahan
    </button>
  )
}

export const EditContractForm = ({ contract }: { contract: ContractView }) => {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState<EditContractState, FormData>(updateContract, {
    error: null,
    warning: null,
    ok: false,
  })

  const [tarif, setTarif] = useState(String(contract.tarif))
  const [cost, setCost] = useState(String(contract.cost))
  const tarifId = useId()
  const costId = useId()
  const dateId = useId()
  const volumeId = useId()

  const previewGpm = gpm(Number(tarif) || 0, Number(cost) || 0)
  const previewBreaches = !meetsTarget(previewGpm, contract.minGpmTarget)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary"
      >
        <Pencil size={15} aria-hidden="true" />
        Ubah Kontrak
      </button>
    )
  }

  return (
    <form action={formAction} className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">Ubah Ketentuan Kontrak</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Batal mengubah kontrak"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <input type="hidden" name="id" value={contract.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label htmlFor={tarifId} className="mb-1.5 block text-xs font-semibold text-gray-700">
            Tarif (Rp)
          </label>
          <input
            id={tarifId}
            name="tarif"
            type="number"
            min="1"
            step="1"
            required
            value={tarif}
            onChange={(event) => setTarif(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={costId} className="mb-1.5 block text-xs font-semibold text-gray-700">
            Cost (Rp)
          </label>
          <input
            id={costId}
            name="cost"
            type="number"
            min="0"
            step="1"
            required
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={volumeId} className="mb-1.5 block text-xs font-semibold text-gray-700">
            Volume ({VOLUME_UNITS[contract.businessLine]})
          </label>
          <input
            id={volumeId}
            name="volume"
            type="number"
            min="1"
            step="1"
            defaultValue={contract.volume ?? ''}
            placeholder="kosongkan bila belum diketahui"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={dateId} className="mb-1.5 block text-xs font-semibold text-gray-700">
            Tanggal Berakhir
          </label>
          <input
            id={dateId}
            name="contract_end_date"
            type="date"
            required
            defaultValue={contract.contractEndDate}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500" aria-live="polite">
        GPM setelah perubahan:{' '}
        <span className={previewBreaches ? 'font-bold text-red-700' : 'font-bold text-green-700'}>
          {formatPercent(previewGpm)}
        </span>{' '}
        terhadap target kontrak ini {formatPercent(contract.minGpmTarget)}.
      </p>

      {state.warning ? (
        <div
          role="alert"
          className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>{state.warning}</p>
            <label className="mt-2 flex items-center gap-2 font-semibold">
              <input type="checkbox" name="acknowledge_breach" className="rounded" />
              Saya memahami margin akan di bawah target dan tetap ingin menyimpan.
            </label>
          </div>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.ok ? (
        <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Perubahan tersimpan.
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        <SaveButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Batal
        </button>
      </div>
    </form>
  )
}
