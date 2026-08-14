import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { GpmIndicator, RfmBadge, StatusBadge } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/states'
import { listContracts, type ContractView } from '@/lib/data/contracts'
import { STATUS_BANDS } from '@/lib/domain'

export const metadata = { title: 'Pelanggan — Gapura Commercial' }

/**
 * One entry per customer, not per contract.
 *
 * Customers stopped being 1:1 with contracts when the Sheet became the source of
 * truth — Garuda Indonesia holds a Ground Handling contract and a Cargo one, Batik
 * Air holds two, and a multi-station contract is several rows besides. Listing
 * contracts here showed the same customer two or three times and gave React
 * duplicate keys into the bargain.
 *
 * `openCaseCount` is already a per-customer figure on every one of that customer's
 * contracts, so it is taken once rather than summed — adding it up would multiply
 * the same cases by the number of contracts they happen to have.
 */
interface CustomerSummary {
  customerId: string
  customerName: string
  rfmStatus: ContractView['rfmStatus']
  businessLines: string[]
  contractCount: number
  openCaseCount: number
  /** The most urgent band across their contracts — the one worth acting on first. */
  status: ContractView['status']
  /** Margin, shown only when there is exactly one contract to speak for. */
  soleContract: ContractView | null
}

const byCustomer = (contracts: ContractView[]): CustomerSummary[] => {
  const grouped = new Map<string, ContractView[]>()
  for (const contract of contracts) {
    const existing = grouped.get(contract.customerId)
    if (existing) existing.push(contract)
    else grouped.set(contract.customerId, [contract])
  }

  // STATUS_BANDS runs least to most urgent, so the highest index wins.
  const urgency = (band: ContractView['status']): number => STATUS_BANDS.indexOf(band)

  return [...grouped.values()].map((lines) => {
    const first = lines[0]!
    return {
      customerId: first.customerId,
      customerName: first.customerName,
      rfmStatus: first.rfmStatus,
      businessLines: [...new Set(lines.map((c) => c.businessLine))],
      contractCount: lines.length,
      openCaseCount: first.openCaseCount,
      status: lines.reduce((worst, c) => (urgency(c.status) > urgency(worst) ? c.status : worst), first.status),
      soleContract: lines.length === 1 ? first : null,
    }
  })
}

export default async function PelangganPage() {
  const contracts = await listContracts()
  const customers = byCustomer(contracts)

  // High standing with unresolved complaints: relationships that are quietly at risk.
  const quietlyAtRisk = customers.filter((c) => c.rfmStatus === 'HIGH' && c.openCaseCount > 0)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Pelanggan</h1>
        <p className="mt-1 text-sm text-gray-600">
          {customers.length} pelanggan dalam cakupan Anda, dengan {contracts.length} baris
          kontrak — satu pelanggan dapat memegang lebih dari satu kontrak.
        </p>
      </header>

      {quietlyAtRisk.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={16} aria-hidden="true" />
            Bernilai Tinggi dengan Kasus Terbuka ({quietlyAtRisk.length})
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            Hubungan bernilai tinggi yang sedang bermasalah — perlu dilindungi sebelum
            pembicaraan perpanjangan dimulai.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {quietlyAtRisk.map((customer) => (
              <li key={customer.customerId}>
                <Link
                  href={`/pelanggan/${customer.customerId}`}
                  className="inline-block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:text-primary"
                >
                  {customer.customerName} · {customer.openCaseCount} kasus
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          judul="Belum ada pelanggan dalam cakupan Anda"
          keterangan="Tidak ada pelanggan yang terdaftar untuk cakupan akses Anda."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {customers.map((customer) => (
            <li key={customer.customerId}>
              <Link
                href={`/pelanggan/${customer.customerId}`}
                className="card-hover block h-full rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-900">{customer.customerName}</p>
                  <RfmBadge status={customer.rfmStatus} />
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  {customer.customerId} · {customer.businessLines.join(' · ')}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={customer.status} />
                  {/* A single margin figure only means something when one contract
                      speaks for the customer; otherwise it would silently be one
                      contract's margin standing in for several. */}
                  {customer.soleContract ? (
                    <GpmIndicator margin={customer.soleContract.margin} />
                  ) : (
                    <span className="text-xs font-semibold text-gray-500">
                      {customer.contractCount} kontrak
                    </span>
                  )}
                </div>
                {customer.openCaseCount > 0 ? (
                  <p className="mt-2.5 text-xs font-semibold text-red-700">
                    {customer.openCaseCount} kasus layanan terbuka
                  </p>
                ) : (
                  <p className="mt-2.5 text-xs text-gray-400">Tidak ada kasus terbuka</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
