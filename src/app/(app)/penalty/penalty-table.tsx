'use client'

import { Check } from 'lucide-react'

import { validasikanPenalty } from '@/app/(app)/penalty/actions'
import { DrillRow } from '@/components/ui/drill-down'
import { Pagination, usePagination } from '@/components/ui/pagination'
import { TAHAP_LABELS, TAHAP_ORDER } from '@/lib/data/domains-constants'
import type { listPenalties } from '@/lib/data/domains'
import { formatRupiahCompact, formatTanggal } from '@/lib/domain'

type Row = Awaited<ReturnType<typeof listPenalties>>[number] & { bisaValidasi: boolean }

const Tahap = ({ tahap }: { tahap: string }) => {
  const index = TAHAP_ORDER.indexOf(tahap)
  const closed = tahap === 'ditutup'
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          closed ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-sem-warn'
        }`}
      >
        {TAHAP_LABELS[tahap] ?? tahap}
      </span>
      <span className="text-[11px] text-gray-400" aria-hidden="true">
        {index + 1}/{TAHAP_ORDER.length}
      </span>
    </span>
  )
}

export const PenaltyTable = ({ rows }: { rows: Row[] }) => {
  const { page, setPage, pageCount, pageItems, total } = usePagination(rows)

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <caption className="sr-only-text">
            Penalty per pelanggan: uraian, nilai, cabang asal, tahap dan tanggal laporan
          </caption>
          <thead>
            <tr className="border-b border-gray-200 text-xs tracking-wide text-gray-500 uppercase">
              <th scope="col" className="sticky left-0 bg-white px-4 py-2.5 text-left">Pelanggan</th>
              <th scope="col" className="px-4 py-2.5 text-left">Uraian</th>
              <th scope="col" className="px-4 py-2.5 text-right">Nilai</th>
              <th scope="col" className="px-4 py-2.5 text-left">Cabang</th>
              <th scope="col" className="px-4 py-2.5 text-left">Tahap</th>
              <th scope="col" className="px-4 py-2.5 text-left">Dilaporkan</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <DrillRow key={row.id} kind="penalty" id={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <th scope="row" className="sticky left-0 bg-white px-4 py-2 text-left font-medium text-gray-700">
                  {row.customerNama}
                </th>
                <td className="max-w-md px-4 py-2 text-gray-600">{row.deskripsi}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                  {row.nilai === null ? <span className="text-gray-300">—</span> : formatRupiahCompact(row.nilai)}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {row.cabangAsal ?? <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2">
                  <Tahap tahap={row.tahap} />
                  {row.divalidasiPada !== null ? (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                      <Check size={11} aria-hidden="true" />
                      Divalidasi cabang
                    </span>
                  ) : row.bisaValidasi ? (
                    <form action={validasikanPenalty} className="mt-1" onClick={(e) => e.stopPropagation()}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                      >
                        <Check size={12} aria-hidden="true" />
                        Validasi cabang saya
                      </button>
                    </form>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-gray-600">
                  {row.dilaporkanPada ? formatTanggal(row.dilaporkanPada) : <span className="text-gray-300">—</span>}
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
