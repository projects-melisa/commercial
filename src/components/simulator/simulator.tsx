'use client'

import { useMemo, useState, useId } from 'react'
import { CheckCircle2, HelpCircle, Info, RotateCcw, Save, XCircle } from 'lucide-react'

import type { ContractView } from '@/lib/data/contracts'
import {
  formatPercent,
  formatPercentagePoints,
  formatRupiah,
  grossProfit,
  marginHealth,
  minimumTarifForTarget,
  formatTarget,
  NO_TARGET_LABEL,
} from '@/lib/domain'

/** How far either side of the contract's real figures the sliders travel. */
const RANGE = 0.5

const round = (value: number): number => Math.round(value)

export const Simulator = ({
  contract,
  onSave,
  saving,
}: {
  contract: ContractView
  onSave?: (nama: string, tarif: number, cost: number) => void
  saving?: boolean
}) => {
  const [tarif, setTarif] = useState(contract.tarif)
  const [cost, setCost] = useState(contract.cost)
  const [nama, setNama] = useState('')
  const tarifId = useId()
  const costId = useId()
  const namaId = useId()

  const simulated = useMemo(
    () => marginHealth(tarif, cost, contract.minGpmTarget),
    [tarif, cost, contract.minGpmTarget],
  )

  /**
   * The negotiating floor: the lowest tarif that still meets target at this cost.
   *
   * Null when the contract has no target, because the floor is derived from one.
   * The simulator still computes GPM — it simply cannot say what "good enough" is.
   */
  const tarifFloor =
    contract.minGpmTarget === null ? null : minimumTarifForTarget(cost, contract.minGpmTarget)
  const changed = tarif !== contract.tarif || cost !== contract.cost

  const insight = useMemo(() => {
    if (contract.minGpmTarget === null || tarifFloor === null || simulated.delta === null) {
      return (
        `Pada tarif ${formatRupiah(tarif)} dan cost ${formatRupiah(cost)}, GPM menjadi ` +
        `${formatPercent(simulated.gpm)}. Kontrak ini ${NO_TARGET_LABEL} target marginnya, ` +
        `sehingga belum ada batas bawah tarif yang bisa dihitung — tetapkan target di ` +
        `sumber data agar skenario dapat dinilai.`
      )
    }
    const target = formatPercent(contract.minGpmTarget)
    if (!simulated.meetsTarget) {
      return (
        `Pada tarif ${formatRupiah(tarif)} dan cost ${formatRupiah(cost)}, GPM menjadi ` +
        `${formatPercent(simulated.gpm)} — ${formatPercentagePoints(simulated.delta)} terhadap ` +
        `target ${target}. Tarif minimum yang masih memenuhi target pada cost ini adalah ` +
        `${formatRupiah(tarifFloor)}. Skenario ini belum layak diajukan tanpa penurunan cost.`
      )
    }
    const headroom = tarif - tarifFloor
    return (
      `Pada tarif ${formatRupiah(tarif)} dan cost ${formatRupiah(cost)}, GPM mencapai ` +
      `${formatPercent(simulated.gpm)} — ${formatPercentagePoints(simulated.delta)} terhadap ` +
      `target ${target}. Masih tersedia ruang ${formatRupiah(headroom)} sebelum tarif ` +
      `menyentuh batas bawah ${formatRupiah(tarifFloor)}, sehingga ada margin untuk bernegosiasi.`
    )
  }, [tarif, cost, simulated, contract.minGpmTarget, tarifFloor])

  const reset = () => {
    setTarif(contract.tarif)
    setCost(contract.cost)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-gray-900">Sesuaikan Tarif dan Cost</h2>

          <div className="mb-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor={tarifId} className="text-xs font-semibold text-gray-700">
                Tarif
              </label>
              <span className="text-sm font-bold text-gray-900">{formatRupiah(tarif)}</span>
            </div>
            <input
              id={tarifId}
              type="range"
              min={round(contract.tarif * (1 - RANGE))}
              max={round(contract.tarif * (1 + RANGE))}
              step={Math.max(1, round(contract.tarif / 500))}
              value={tarif}
              onChange={(event) => setTarif(Number(event.target.value))}
              className="w-full"
              aria-valuetext={formatRupiah(tarif)}
            />
            <p className="mt-1 text-xs text-gray-400">
              Semula {formatRupiah(contract.tarif)}
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor={costId} className="text-xs font-semibold text-gray-700">
                Cost
              </label>
              <span className="text-sm font-bold text-gray-900">{formatRupiah(cost)}</span>
            </div>
            <input
              id={costId}
              type="range"
              min={round(contract.cost * (1 - RANGE))}
              max={round(contract.cost * (1 + RANGE))}
              step={Math.max(1, round(contract.cost / 500))}
              value={cost}
              onChange={(event) => setCost(Number(event.target.value))}
              className="w-full"
              aria-valuetext={formatRupiah(cost)}
            />
            <p className="mt-1 text-xs text-gray-400">Semula {formatRupiah(contract.cost)}</p>
          </div>

          <button
            type="button"
            onClick={reset}
            disabled={!changed}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Kembalikan ke angka kontrak
          </button>
        </section>

        {/*
         * The panel changes state the moment simulated GPM crosses the contract's own
         * target, so the limit is visible without doing the arithmetic. aria-live
         * announces the crossing rather than leaving it to colour.
         */}
        <section
          className={`rounded-xl border p-5 transition-colors ${
            simulated.meetsTarget === null
              ? 'border-gray-300 bg-gray-50'
              : simulated.meetsTarget
                ? 'border-green-300 bg-green-50'
                : 'border-red-300 bg-red-50'
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            {/* Neutral, not red: "no target set" is not a failed target, and painting
                it as one would report a breach nobody ever defined. */}
            {simulated.meetsTarget === null ? (
              <HelpCircle size={18} className="text-gray-500" aria-hidden="true" />
            ) : simulated.meetsTarget ? (
              <CheckCircle2 size={18} className="text-green-700" aria-hidden="true" />
            ) : (
              <XCircle size={18} className="text-red-700" aria-hidden="true" />
            )}
            <h2
              className={`text-sm font-bold ${
                simulated.meetsTarget === null
                  ? 'text-gray-700'
                  : simulated.meetsTarget
                    ? 'text-green-900'
                    : 'text-red-900'
              }`}
            >
              {simulated.meetsTarget === null
                ? 'Target margin belum ditetapkan'
                : simulated.meetsTarget
                  ? 'Memenuhi target margin'
                  : 'Di bawah target margin'}
            </h2>
          </div>

          <p className="sr-only-text" role="status" aria-live="polite">
            GPM simulasi {formatPercent(simulated.gpm)},{' '}
            {simulated.meetsTarget === null
              ? `target ${NO_TARGET_LABEL}`
              : `${simulated.meetsTarget ? 'memenuhi' : 'di bawah'} target ${formatPercent(contract.minGpmTarget!)}`}
            .
          </p>

          {/* Baseline sits beside simulated so the effect of the change is explicit. */}
          <dl className="grid grid-cols-3 gap-3 text-sm">
            <div className="col-span-1" />
            <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Semula</dt>
            <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              Simulasi
            </dt>

            <dt className="text-xs font-semibold text-gray-600">Tarif</dt>
            <dd className="text-gray-700">{formatRupiah(contract.tarif)}</dd>
            <dd className="font-bold text-gray-900">{formatRupiah(tarif)}</dd>

            <dt className="text-xs font-semibold text-gray-600">Cost</dt>
            <dd className="text-gray-700">{formatRupiah(contract.cost)}</dd>
            <dd className="font-bold text-gray-900">{formatRupiah(cost)}</dd>

            <dt className="text-xs font-semibold text-gray-600">Gross Profit</dt>
            <dd className="text-gray-700">{formatRupiah(grossProfit(contract.tarif, contract.cost))}</dd>
            <dd className="font-bold text-gray-900">{formatRupiah(grossProfit(tarif, cost))}</dd>

            <dt className="text-xs font-semibold text-gray-600">GPM</dt>
            <dd className="text-gray-700">{formatPercent(contract.margin.gpm)}</dd>
            <dd
              className={`text-lg font-extrabold ${
                simulated.meetsTarget === null
                  ? 'text-gray-900'
                  : simulated.meetsTarget
                    ? 'text-green-700'
                    : 'text-red-700'
              }`}
            >
              {formatPercent(simulated.gpm)}
            </dd>
          </dl>

          <div className="mt-4 space-y-1.5 border-t border-black/10 pt-4 text-sm">
            <p className="flex justify-between">
              <span className="text-gray-600">Target kontrak ini</span>
              <span className="font-bold text-gray-900">
                {formatTarget(contract.minGpmTarget)}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-600">Selisih terhadap target</span>
              <span
                className={`font-bold ${
                  simulated.meetsTarget === null
                    ? 'text-gray-500'
                    : simulated.meetsTarget
                      ? 'text-green-700'
                      : 'text-red-700'
                }`}
              >
                {simulated.delta === null ? '—' : formatPercentagePoints(simulated.delta)}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-600">Tarif minimum untuk target</span>
              <span className="font-bold text-gray-900">
                {tarifFloor === null ? '—' : formatRupiah(tarifFloor)}
              </span>
            </p>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900">
          <Info size={16} aria-hidden="true" />
          Ringkasan untuk Negosiasi
        </h2>
        <p className="text-sm leading-relaxed text-blue-900">{insight}</p>
      </section>

      {onSave ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-900">Simpan Skenario</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor={namaId} className="mb-1.5 block text-xs font-semibold text-gray-700">
                Nama skenario
              </label>
              <input
                id={namaId}
                type="text"
                value={nama}
                onChange={(event) => setNama(event.target.value)}
                placeholder="mis. Kenaikan tarif 8% dengan cost tetap"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="button"
              disabled={nama.trim() === '' || saving}
              onClick={() => onSave(nama.trim(), tarif, cost)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light disabled:opacity-50"
            >
              <Save size={15} aria-hidden="true" />
              {saving ? 'Menyimpan…' : 'Simpan Skenario'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )
}
