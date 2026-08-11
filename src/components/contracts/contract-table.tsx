'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'

import { GpmIndicator, GpmVsTarget, RfmBadge, StatusBadge } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/states'
import type { ContractView } from '@/lib/data/contracts'
import {
  BUSINESS_LINES,
  formatRupiahCompact,
  formatSisaHari,
  formatTanggal,
  RFM_STATUSES,
  STATUS_BANDS,
  type BusinessLine,
  type RfmStatus,
  type StatusBand,
} from '@/lib/domain'

type SortKey = 'sisaHari' | 'margin'
type SortDirection = 'asc' | 'desc'

const SELECT_CLASS =
  'rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-700'

export const ContractTable = ({
  contracts,
  showFilters = true,
}: {
  contracts: ContractView[]
  showFilters?: boolean
}) => {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusBand | 'all'>('all')
  const [businessLine, setBusinessLine] = useState<BusinessLine | 'all'>('all')
  const [rfm, setRfm] = useState<RfmStatus | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('sisaHari')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = contracts.filter(
      (contract) =>
        (needle === '' || contract.customerName.toLowerCase().includes(needle)) &&
        (status === 'all' || contract.status === status) &&
        (businessLine === 'all' || contract.businessLine === businessLine) &&
        (rfm === 'all' || contract.rfmStatus === rfm),
    )

    const factor = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) =>
      sortKey === 'sisaHari'
        ? (a.daysLeft - b.daysLeft) * factor
        : (a.margin.gpm - b.margin.gpm) * factor,
    )
  }, [contracts, query, status, businessLine, rfm, sortKey, sortDirection])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const SortButton = ({ label, sortBy }: { label: string; sortBy: SortKey }) => {
    const active = sortKey === sortBy
    return (
      <button
        type="button"
        onClick={() => toggleSort(sortBy)}
        // Negative margin grows the hit area into the cell's own padding, so the
        // control clears the 24px floor without moving the header row.
        className="-my-1.5 inline-flex items-center gap-1 py-1.5 font-semibold hover:text-primary"
        aria-label={`Urutkan berdasarkan ${label}`}
      >
        {label}
        {active ? (
          sortDirection === 'asc' ? (
            <ArrowUp size={11} aria-hidden="true" />
          ) : (
            <ArrowDown size={11} aria-hidden="true" />
          )
        ) : null}
      </button>
    )
  }

  return (
    <div>
      {showFilters ? (
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama pelanggan…"
              aria-label="Cari nama pelanggan"
              className="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-9 text-sm"
            />
          </div>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusBand | 'all')}
            aria-label="Saring berdasarkan status"
            className={SELECT_CLASS}
          >
            <option value="all">Semua Status</option>
            {STATUS_BANDS.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </select>

          <select
            value={businessLine}
            onChange={(event) => setBusinessLine(event.target.value as BusinessLine | 'all')}
            aria-label="Saring berdasarkan lini bisnis"
            className={SELECT_CLASS}
          >
            <option value="all">Semua Lini Bisnis</option>
            {BUSINESS_LINES.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>

          <select
            value={rfm}
            onChange={(event) => setRfm(event.target.value as RfmStatus | 'all')}
            aria-label="Saring berdasarkan standing RFM"
            className={SELECT_CLASS}
          >
            <option value="all">Semua RFM</option>
            {RFM_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="p-4">
          <EmptyState
            judul="Tidak ada kontrak yang cocok"
            keterangan="Tidak ada kontrak yang sesuai dengan pencarian dan saringan saat ini. Coba longgarkan salah satunya."
          />
        </div>
      ) : (
        <div className="scroll-hint relative overflow-x-auto">
          <table className="w-full min-w-[64rem] text-left text-sm">
            <caption className="sr-only-text">
              Daftar kontrak dalam cakupan Anda, {visible.length} baris.
            </caption>
            <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Pelanggan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Lini Bisnis
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Jenis Layanan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Status
                </th>
                <th
                  scope="col"
                  className="px-4 py-3"
                  aria-sort={
                    sortKey === 'sisaHari'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <SortButton label="Sisa Hari" sortBy="sisaHari" />
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tanggal Berakhir
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  RFM
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Tarif
                </th>
                <th
                  scope="col"
                  className="px-4 py-3"
                  aria-sort={
                    sortKey === 'margin'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <SortButton label="GPM" sortBy="margin" />
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  vs Target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((contract) => (
                <tr key={contract.id} className="table-row">
                  <td className="px-4 py-3">
                    <Link
                      href={`/kontrak/${contract.id}`}
                      className="font-semibold text-gray-900 hover:text-primary"
                    >
                      {contract.customerName}
                    </Link>
                    <p className="text-xs text-gray-400">{contract.customerId}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{contract.businessLine}</td>
                  <td className="px-4 py-3 text-gray-600">{contract.serviceType}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={contract.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {formatSisaHari(contract.daysLeft)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                    {formatTanggal(contract.contractEndDate)}
                  </td>
                  <td className="px-4 py-3">
                    <RfmBadge status={contract.rfmStatus} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {formatRupiahCompact(contract.tarif)}
                  </td>
                  <td className="px-4 py-3">
                    <GpmIndicator margin={contract.margin} />
                  </td>
                  <td className="px-4 py-3">
                    <GpmVsTarget margin={contract.margin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
