'use client'

import { useRevenueDrillDown } from '@/components/revenue/drill-down'
import { formatMeasure, formatPercent, type Measure } from '@/lib/domain'
import { DIMENSI, type DimensiKey, type Peringkat, type RevenueRow } from '@/lib/data/revenue-pure'

/**
 * The ranking tables, shared by every tab so a column cannot mean two things.
 *
 * Colour is never the only marker. Negatives are bracketed, bands carry an arrow, and
 * every cell still shows its number — roughly one man in twelve cannot separate the
 * red from the green, and every figure on these pages is a judgement.
 */

export const Ach = ({ value }: { value: number | null }) => {
  if (value === null) return <span className="text-gray-400">—</span>
  const tone = value >= 0.95 ? 'text-sem-ok' : value >= 0.6 ? 'text-sem-warn' : 'text-sem-bad'
  const arrow = value >= 0.95 ? '▲' : value >= 0.6 ? '▲' : '▼'
  return (
    <span className={`font-semibold ${tone}`}>
      <span aria-hidden="true">{arrow} </span>
      {formatPercent(value)}
    </span>
  )
}

export const Signed = ({ value, measure }: { value: number; measure: Measure }) => (
  <span className={value < 0 ? 'font-semibold text-sem-bad' : 'font-semibold text-sem-ok'}>
    {value < 0
      ? `(${formatMeasure(measure, Math.abs(value))})`
      : formatMeasure(measure, value)}
  </span>
)

export const Yoy = ({ value }: { value: number | null }) =>
  value === null ? (
    <span className="text-gray-400">—</span>
  ) : (
    <span className={value < 0 ? 'text-sem-bad' : 'text-sem-ok'}>
      <span aria-hidden="true">{value < 0 ? '▼ ' : '▲ '}</span>
      {formatPercent(value)}
    </span>
  )

/** One clickable cell: click opens the source rows behind exactly this figure. */
const Cell = ({
  onClick,
  className,
  children,
}: {
  onClick: () => void
  className?: string
  children: React.ReactNode
}) => (
  <td className="p-0">
    <button
      type="button"
      onClick={onClick}
      className={`block w-full px-3 py-2 text-right hover:bg-gray-100 ${className ?? ''}`}
    >
      {children}
    </button>
  </td>
)

export const Ranking = ({
  judul,
  keterangan,
  kolom,
  baris,
  measure,
  tahun,
  rows,
  dimensiKey,
}: {
  judul: string
  keterangan?: string
  kolom: string
  baris: Peringkat[]
  measure: Measure
  tahun: number
  /** The source rows, so a cell click can show exactly what sums into that figure. */
  rows: RevenueRow[]
  /** The same `DIMENSI` key the ranking was built with — a function can't cross the
   * server/client prop boundary, so the dimension travels as its name instead. */
  dimensiKey: DimensiKey
}) => {
  const { show, dialog } = useRevenueDrillDown()
  const keyFn = DIMENSI[dimensiKey]
  const label = (r: RevenueRow): string => keyFn(r) ?? '(tanpa keterangan)'

  const pick = (nama: string, judulSel: string, matcher: (r: RevenueRow) => boolean) =>
    show(`${nama} — ${judulSel}`, rows.filter((r) => label(r) === nama && matcher(r)))

  return (
    // `relative` is load-bearing: the visually-hidden caption inside a horizontal scroll
    // container is position:absolute, and without a positioned ancestor it resolves
    // against the initial containing block and drags the page sideways on a phone.
    <section className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-bold text-gray-900">{judul}</h2>
        {keterangan ? <p className="mt-0.5 text-xs text-gray-400">{keterangan}</p> : null}
      </div>
      {baris.length === 0 ? (
        <p className="px-4 py-6 text-sm text-gray-400">Tidak ada baris untuk dimensi ini.</p>
      ) : (
        <table className="w-full min-w-[44rem] text-sm">
          <caption className="sr-only-text">{judul}</caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
              <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left">{kolom}</th>
              <th scope="col" className="px-3 py-2.5 text-right">{tahun - 1}</th>
              <th scope="col" className="px-3 py-2.5 text-right">RKAP {tahun}</th>
              <th scope="col" className="px-3 py-2.5 text-right">Aktual {tahun}</th>
              <th scope="col" className="px-3 py-2.5 text-right">Diff</th>
              <th scope="col" className="px-3 py-2.5 text-right">%Ach</th>
              <th scope="col" className="px-3 py-2.5 text-right">%YoY</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {baris.map((row) => {
              const isPlan = (r: RevenueRow) => r.plan_actual === 'Plan'
              const isActual = (r: RevenueRow) => r.plan_actual === 'Actual'
              const thisYear = (r: RevenueRow) => r.tahun === tahun
              const lastYear = (r: RevenueRow) => r.tahun === tahun - 1

              return (
                <tr key={row.nama} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-gray-700">
                    {row.nama}
                  </th>
                  <Cell
                    className="text-gray-400"
                    onClick={() => pick(row.nama, `Aktual ${tahun - 1}`, (r) => lastYear(r) && isActual(r))}
                  >
                    {formatMeasure(measure, row.sebelumnya)}
                  </Cell>
                  <Cell
                    className="text-gray-600"
                    onClick={() => pick(row.nama, `RKAP ${tahun}`, (r) => thisYear(r) && isPlan(r))}
                  >
                    {formatMeasure(measure, row.rkap)}
                  </Cell>
                  <Cell
                    className="font-semibold text-gray-900"
                    onClick={() => pick(row.nama, `Aktual ${tahun}`, (r) => thisYear(r) && isActual(r))}
                  >
                    {formatMeasure(measure, row.aktual)}
                  </Cell>
                  <Cell
                    onClick={() => pick(row.nama, `RKAP vs Aktual ${tahun}`, (r) => thisYear(r) && (isPlan(r) || isActual(r)))}
                  >
                    <Signed value={row.diff} measure={measure} />
                  </Cell>
                  <Cell
                    onClick={() => pick(row.nama, `RKAP vs Aktual ${tahun}`, (r) => thisYear(r) && (isPlan(r) || isActual(r)))}
                  >
                    <Ach value={row.ach} />
                  </Cell>
                  <Cell
                    onClick={() =>
                      pick(row.nama, `Aktual ${tahun} vs ${tahun - 1}`, (r) => isActual(r) && (thisYear(r) || lastYear(r)))
                    }
                  >
                    <Yoy value={row.yoy} />
                  </Cell>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {dialog}
    </section>
  )
}
