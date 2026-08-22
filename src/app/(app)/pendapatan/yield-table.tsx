'use client'

import { useRevenueDrillDown } from '@/components/revenue/drill-down'
import { DIMENSI, yieldBy, type RevenueRow } from '@/lib/data/revenue-pure'
import { formatMeasure, formatRupiah } from '@/lib/domain'

/**
 * Rupiah per unit produced, which is the question the Production tab is actually for.
 *
 * Volume on its own says nothing about whether the volume was worth having: a station
 * can beat its production budget while earning less per unit than anyone else. The
 * quotient is taken from the two totals, never averaged across rows — ten thousand
 * cheap units and ten expensive ones must not come out level.
 */
export const YieldTable = ({ rows, tahun }: { rows: RevenueRow[]; tahun: number }) => {
  const perLob = yieldBy(rows, tahun, DIMENSI.lob)
  const perCabang = yieldBy(rows, tahun, DIMENSI.cabang)

  const Table = ({
    judul,
    kolom,
    data,
    keyFn,
  }: {
    judul: string
    kolom: string
    data: typeof perLob
    keyFn: (row: RevenueRow) => string | null
  }) => {
    const { show, dialog } = useRevenueDrillDown()
    const label = (r: RevenueRow): string => keyFn(r) ?? '(tanpa keterangan)'
    const pick = (nama: string) =>
      show(`${nama} — Aktual ${tahun}`, rows.filter((r) => label(r) === nama && r.tahun === tahun && r.plan_actual === 'Actual'))

    return (
      <section className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-bold text-gray-900">{judul}</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            Pendapatan aktual dibagi produksi aktual {tahun}. Urut dari yield tertinggi.
          </p>
        </div>
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only-text">{judul}</caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
              <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left">{kolom}</th>
              <th scope="col" className="px-3 py-2.5 text-right">Produksi</th>
              <th scope="col" className="px-3 py-2.5 text-right">Pendapatan</th>
              <th scope="col" className="px-3 py-2.5 text-right">Rp / unit</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((row) => (
              <tr key={row.nama} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-gray-700">
                  {row.nama}
                </th>
                <td className="p-0 text-right">
                  <button
                    type="button"
                    onClick={() => pick(row.nama)}
                    className="block w-full px-3 py-2 text-right text-gray-600 hover:bg-gray-100"
                  >
                    {formatMeasure('unit', row.produksi)}
                  </button>
                </td>
                <td className="p-0 text-right">
                  <button
                    type="button"
                    onClick={() => pick(row.nama)}
                    className="block w-full px-3 py-2 text-right text-gray-600 hover:bg-gray-100"
                  >
                    {formatMeasure('rupiah', row.pendapatan)}
                  </button>
                </td>
                <td className="p-0 text-right">
                  <button
                    type="button"
                    onClick={() => pick(row.nama)}
                    className="block w-full px-3 py-2 text-right font-semibold text-gray-900 hover:bg-gray-100"
                  >
                    {formatRupiah(row.perUnit)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dialog}
      </section>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Table judul="Yield per Line of Business" kolom="LoB" data={perLob} keyFn={DIMENSI.lob} />
      <Table judul="Yield per cabang" kolom="Cabang" data={perCabang} keyFn={DIMENSI.cabang} />
    </div>
  )
}
