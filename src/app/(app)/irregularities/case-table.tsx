'use client'

import { DrillRow } from '@/components/ui/drill-down'
import { Pagination, usePagination } from '@/components/ui/pagination'
import type { listIrregularities } from '@/lib/data/domains'

type Row = Awaited<ReturnType<typeof listIrregularities>>[number]

export const CaseTable = ({ rows }: { rows: Row[] }) => {
  const { page, setPage, pageCount, pageItems, total } = usePagination(rows)

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <caption className="sr-only-text">Kasus layanan per pelanggan, dengan statusnya</caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
              <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left">Pelanggan</th>
              <th scope="col" className="px-4 py-2.5 text-left">Uraian kasus</th>
              <th scope="col" className="px-4 py-2.5 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <DrillRow key={row.id} kind="case" id={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-gray-700">
                  {row.customerNama}
                </th>
                <td className="px-4 py-2 text-gray-600">{row.description}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.status === 'OPEN' ? 'bg-amber-100 text-sem-warn' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </DrillRow>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} />
    </section>
  )
}
