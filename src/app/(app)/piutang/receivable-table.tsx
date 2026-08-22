'use client'

import { DrillRow } from '@/components/ui/drill-down'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { AGING_BUCKETS } from '@/lib/data/domains-constants'
import type { listReceivables } from '@/lib/data/domains'
import { formatRupiah, formatRupiahCompact } from '@/lib/domain'

type Row = Awaited<ReturnType<typeof listReceivables>>[number]

export const ReceivableTable = ({ rows, total }: { rows: Row[]; total: number }) => {
  const { page, setPage, pageCount, pageItems, total: count } = usePagination(rows)

  return (
    // `relative` is load-bearing: the visually-hidden caption inside a horizontal
    // scroll container is position:absolute, and without a positioned ancestor it
    // resolves against the initial containing block and drags the page sideways.
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only-text">
            Piutang per pelanggan, delapan bucket umur dan totalnya
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
              <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left">Pelanggan</th>
              <th scope="col" className="px-3 py-2.5 text-left">Status</th>
              {AGING_BUCKETS.map(([key, label]) => (
                <th key={key} scope="col" className="px-3 py-2.5 text-right">{label}</th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {pageItems.map((row) => (
              <DrillRow key={row.customerId} kind="receivable" id={row.customerId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-gray-700">
                  {row.customerNama}
                </th>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.status === 'OPEN' ? 'bg-amber-100 text-sem-warn' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                {AGING_BUCKETS.map(([key]) => (
                  <td
                    key={key}
                    className={`px-3 py-2 text-right ${row.buckets[key] === 0 ? 'text-gray-300' : 'text-gray-700'}`}
                  >
                    {row.buckets[key] === 0 ? '—' : formatRupiahCompact(row.buckets[key])}
                  </td>
                ))}
                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                  {formatRupiahCompact(row.total)}
                </td>
              </DrillRow>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50 tabular-nums">
              <th scope="row" className="sticky left-0 bg-gray-50 px-4 py-2.5 text-left font-bold text-gray-900">
                Akumulasi
              </th>
              <td />
              {AGING_BUCKETS.map(([key]) => (
                <td key={key} className="px-3 py-2.5 text-right text-gray-600">
                  {formatRupiahCompact(rows.reduce((sum, row) => sum + row.buckets[key], 0))}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-extrabold text-gray-900">
                {formatRupiah(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={count} />
    </section>
  )
}
