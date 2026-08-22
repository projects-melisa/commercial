'use client'

import { Pagination, usePagination } from '@/components/ui/pagination'

export type AuditRow = {
  pada: string
  aksi: string
  detail: unknown
  nama: string
}

export const AuditTable = ({ rows }: { rows: AuditRow[] }) => {
  const { page, setPage, pageCount, pageItems, total } = usePagination(rows)

  return (
    <section className="relative overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full min-w-[48rem] text-sm">
        <caption className="sr-only-text">Log aktivitas lintas modul</caption>
        <thead>
          <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
            <th scope="col" className="px-4 py-2.5 text-left">Waktu</th>
            <th scope="col" className="px-4 py-2.5 text-left">Aktor</th>
            <th scope="col" className="px-4 py-2.5 text-left">Peristiwa</th>
            <th scope="col" className="px-4 py-2.5 text-left">Detail</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-2 tabular-nums text-gray-600">
                {new Date(row.pada).toLocaleString('id-ID', {
                  dateStyle: 'short',
                  timeStyle: 'medium',
                  timeZone: 'Asia/Jakarta',
                })}
              </td>
              <td className="px-4 py-2 text-gray-700">{row.nama}</td>
              <td className="px-4 py-2 font-medium text-gray-900">{row.aksi}</td>
              <td className="max-w-md px-4 py-2 font-mono text-xs text-gray-500">
                {JSON.stringify(row.detail)}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-400">
                Belum ada peristiwa tercatat.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} />
    </section>
  )
}
