'use client'

import Link from 'next/link'

import { RfmBadge, StatusBadge } from '@/components/ui/badges'
import { DrillRow } from '@/components/ui/drill-down'
import type { ContractView } from '@/lib/data/contracts'
import { formatSisaHari, formatTanggal } from '@/lib/domain'

/**
 * One contract as the monitoring table shows it, with the two standings that live in
 * other modules attached.
 *
 * Both are nullable and the page decides whether the column appears at all: a caller
 * without `piutang:view` gets no receivable column rather than an empty one, because
 * an empty cell reads as "nothing owed" and that is the opposite of the truth.
 */
export interface MonitorRow {
  contract: ContractView
  piutangStatus: string | null
  irregularityStatus: 'OPEN' | 'CLOSED' | null
}

/**
 * OPEN / CLOSED, the two words the source uses. OPEN is the one that needs a person,
 * so it carries the colour; CLOSED stays quiet rather than competing with it.
 */
const OpenClosedPill = ({ status }: { status: string | null }) => {
  if (status === null) {
    return (
      <span className="text-gray-400">
        —<span className="sr-only-text"> tidak ada data</span>
      </span>
    )
  }

  const open = status.toUpperCase() === 'OPEN'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        open ? 'bg-red-100 text-sem-bad' : 'bg-gray-100 text-gray-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${open ? 'bg-red-600' : 'bg-gray-400'}`}
        aria-hidden="true"
      />
      {status.toUpperCase()}
    </span>
  )
}

const HEAD = 'sticky top-0 z-10 bg-gray-50 px-3 py-2.5 font-semibold whitespace-nowrap'

export const MonitorTable = ({
  rows,
  showPiutang,
  showIrregularities,
}: {
  rows: MonitorRow[]
  showPiutang: boolean
  showIrregularities: boolean
}) => (
  // Vertical scroll with a stuck header, so a book of any size keeps its column names
  // in view without the page itself growing to the length of the portfolio.
  <div className="scroll-hint relative max-h-[30rem] overflow-auto">
    <table className="w-full min-w-[72rem] border-separate border-spacing-0 text-left text-sm">
      <caption className="sr-only-text">
        Pemantauan kontrak, {rows.length} baris, diurutkan dari yang paling mendesak.
      </caption>
      <thead className="text-xs text-gray-500">
        <tr>
          <th scope="col" className={`${HEAD} border-b border-gray-200 pl-4`}>
            Pelanggan
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200`}>
            Lini Bisnis
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200`}>
            Station
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200`}>
            Segmentasi
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200`}>
            Status
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200 text-right`}>
            Sisa Hari
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200`}>
            Berakhir
          </th>
          {showPiutang ? (
            <th scope="col" className={`${HEAD} border-b border-gray-200`}>
              Piutang
            </th>
          ) : null}
          {showIrregularities ? (
            <th scope="col" className={`${HEAD} border-b border-gray-200`}>
              Irregularity
            </th>
          ) : null}
          <th scope="col" className={`${HEAD} border-b border-gray-200`}>
            Remarks
          </th>
          <th scope="col" className={`${HEAD} border-b border-gray-200 pr-4`}>
            Kontrak Terakhir
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ contract, piutangStatus, irregularityStatus }) => (
          <DrillRow key={contract.id} kind="contract" id={contract.id} className="table-row">
            <td className="border-b border-gray-100 px-3 py-2.5 pl-4 whitespace-nowrap">
              <Link
                href={`/kontrak/${contract.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-gray-900 hover:text-primary"
              >
                {contract.customerName}
              </Link>
            </td>
            <td className="border-b border-gray-100 px-3 py-2.5 whitespace-nowrap text-gray-600">
              {contract.businessLine}
            </td>
            {/* A null cabang is the Sheet's "All Station" — one specific arrangement,
                not a missing value, so it is named rather than dashed. */}
            <td className="border-b border-gray-100 px-3 py-2.5 whitespace-nowrap text-gray-600">
              {contract.cabang ?? 'All Station'}
            </td>
            <td className="border-b border-gray-100 px-3 py-2.5">
              <RfmBadge status={contract.rfmStatus} />
            </td>
            <td className="border-b border-gray-100 px-3 py-2.5">
              <StatusBadge status={contract.status} />
            </td>
            <td
              className={`border-b border-gray-100 px-3 py-2.5 text-right font-bold whitespace-nowrap tabular-nums ${
                contract.daysLeft < 0 ? 'text-sem-bad' : 'text-gray-700'
              }`}
            >
              {formatSisaHari(contract.daysLeft)}
            </td>
            <td className="border-b border-gray-100 px-3 py-2.5 whitespace-nowrap text-gray-600 tabular-nums">
              {formatTanggal(contract.contractEndDate)}
            </td>
            {showPiutang ? (
              <td className="border-b border-gray-100 px-3 py-2.5">
                <OpenClosedPill status={piutangStatus} />
              </td>
            ) : null}
            {showIrregularities ? (
              <td className="border-b border-gray-100 px-3 py-2.5">
                <OpenClosedPill status={irregularityStatus} />
              </td>
            ) : null}
            <td className="max-w-[12rem] truncate border-b border-gray-100 px-3 py-2.5 text-gray-600">
              {contract.remarks ?? '—'}
            </td>
            <td className="max-w-[12rem] truncate border-b border-gray-100 px-3 py-2.5 pr-4 text-gray-600">
              {contract.latestContract ?? '—'}
            </td>
          </DrillRow>
        ))}
      </tbody>
    </table>
  </div>
)
