import { BarChart2 } from 'lucide-react'

import { ExportButton } from '@/app/(app)/laporan/export-button'
import { CompositionBar, ExpiryTimeline, MarginHistogram, StatusDonut } from '@/components/dashboard/charts'
import { GpmVsTarget } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/states'
import { requireProfile, scopeLabel } from '@/lib/auth'
import {
  countBy,
  expiryTimeline,
  marginDistribution,
  performanceByBusinessLine,
  statusDistribution,
} from '@/lib/data/analytics'
import { listCasesForCustomers, listContracts } from '@/lib/data/contracts'
import { formatPercent, formatTarget } from '@/lib/domain'

export const metadata = { title: 'Laporan — Gapura Commercial' }

export default async function LaporanPage() {
  const profile = await requireProfile()
  // Reports read through exactly the same scoped query as every other screen, so the
  // figures here cannot disagree with the dashboard or the contract list.
  const contracts = await listContracts()

  if (contracts.length === 0) {
    return (
      <EmptyState
        judul="Belum ada data untuk dilaporkan"
        keterangan="Tidak ada kontrak dalam cakupan akses Anda."
      />
    )
  }

  const perLine = performanceByBusinessLine(contracts)
  const rfmComposition = countBy(contracts, (c) => c.rfmStatus)

  // Case summary by status and business line. Counted per contract, as before, so a
  // customer holding two contracts still contributes to both of their lines.
  const casesByCustomer = await listCasesForCustomers(contracts.map((c) => c.customerId))
  const caseSummary = new Map<string, { open: number; closed: number }>()
  for (const contract of contracts) {
    const entry = caseSummary.get(contract.businessLine) ?? { open: 0, closed: 0 }
    for (const serviceCase of casesByCustomer.get(contract.customerId) ?? []) {
      if (serviceCase.status === 'OPEN') entry.open += 1
      else entry.closed += 1
    }
    caseSummary.set(contract.businessLine, entry)
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 sm:text-2xl">
            <BarChart2 className="text-primary" size={22} aria-hidden="true" />
            Laporan &amp; Analitik
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Cakupan: {scopeLabel(profile)} — sesuai hak akses Anda.
          </p>
        </div>
        <ExportButton contracts={contracts} />
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MarginHistogram data={marginDistribution(contracts)} />
        <StatusDonut data={statusDistribution(contracts)} />
        <ExpiryTimeline data={expiryTimeline(contracts)} />
        <CompositionBar
          judul="Komposisi RFM Pelanggan"
          ringkasan={rfmComposition.map((d) => `${d.name}: ${d.value} pelanggan`).join('. ')}
          data={rfmComposition}
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-gray-900">GPM Setiap Kontrak vs Targetnya</h2>
        <div className="scroll-hint relative overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-500">
              <tr>
                <th scope="col" className="pb-2 font-semibold">
                  Pelanggan
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Lini Bisnis
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  GPM
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Target
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Selisih
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...contracts]
                // Worst breach first; contracts with no target have no position in
                // that order, so they sort to the end rather than to the top.
                .sort((a, b) => (a.margin.delta ?? Infinity) - (b.margin.delta ?? Infinity))
                .map((contract) => (
                  <tr key={contract.id}>
                    <td className="py-2 font-medium text-gray-900">{contract.customerName}</td>
                    <td className="py-2 text-gray-600">{contract.businessLine}</td>
                    <td className="py-2 text-gray-700">{formatPercent(contract.margin.gpm)}</td>
                    <td className="py-2 text-gray-700">{formatTarget(contract.minGpmTarget)}</td>
                    <td className="py-2">
                      <GpmVsTarget margin={contract.margin} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-gray-900">Performa per Lini Bisnis</h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-500">
              <tr>
                <th scope="col" className="pb-2 font-semibold">
                  Lini Bisnis
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Kontrak
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Rata-rata GPM
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Di Bawah Target
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {perLine.map((line) => (
                <tr key={line.businessLine}>
                  <th scope="row" className="py-2 font-medium text-gray-900">
                    {line.businessLine}
                  </th>
                  <td className="py-2 text-gray-600">{line.jumlah}</td>
                  <td className="py-2 font-semibold text-gray-900">
                    {formatPercent(line.rataGpm)}
                  </td>
                  <td
                    className={`py-2 font-semibold ${
                      line.dibawahTarget > 0 ? 'text-red-700' : 'text-green-700'
                    }`}
                  >
                    {line.dibawahTarget}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-gray-900">
            Kasus Layanan per Status &amp; Lini Bisnis
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-xs text-gray-500">
              <tr>
                <th scope="col" className="pb-2 font-semibold">
                  Lini Bisnis
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Terbuka
                </th>
                <th scope="col" className="pb-2 font-semibold">
                  Selesai
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...caseSummary.entries()].map(([businessLine, counts]) => (
                <tr key={businessLine}>
                  <th scope="row" className="py-2 font-medium text-gray-900">
                    {businessLine}
                  </th>
                  <td
                    className={`py-2 font-semibold ${
                      counts.open > 0 ? 'text-red-700' : 'text-gray-500'
                    }`}
                  >
                    {counts.open}
                  </td>
                  <td className="py-2 text-gray-600">{counts.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
