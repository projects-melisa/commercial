'use client'

import { Download } from 'lucide-react'

import type { ContractView } from '@/lib/data/contracts'

const COLUMNS = [
  'CustomerID',
  'CustomerName',
  'BusinessLine',
  'ServiceType',
  'ContractEndDate',
  'SisaHari',
  'Status',
  'RFM_Status',
  'Tarif',
  'Cost',
  'GPM',
  'Min_GPM_Target',
  'SelisihTerhadapTarget',
  'KasusTerbuka',
] as const

const escapeCsv = (value: string | number): string => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Exports the current view as CSV, client-side.
 *
 * The rows exported are exactly the rows the server sent, so the export inherits the
 * caller's access scope rather than re-querying with wider reach.
 */
export const ExportButton = ({ contracts }: { contracts: ContractView[] }) => {
  const download = () => {
    const rows = contracts.map((contract) => [
      contract.customerId,
      contract.customerName,
      contract.businessLine,
      contract.serviceType,
      contract.contractEndDate,
      contract.daysLeft,
      contract.status,
      contract.rfmStatus,
      contract.tarif,
      contract.cost,
      contract.margin.gpm.toFixed(4),
      contract.minGpmTarget.toFixed(4),
      contract.margin.delta.toFixed(4),
      contract.openCaseCount,
    ])

    const csv = [COLUMNS, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    // The BOM keeps Excel from mangling the Indonesian text on open.
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `g-cme-laporan-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary"
    >
      <Download size={15} aria-hidden="true" />
      Ekspor CSV
    </button>
  )
}
