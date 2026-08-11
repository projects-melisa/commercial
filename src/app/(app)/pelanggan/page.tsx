import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

import { GpmIndicator, RfmBadge, StatusBadge } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/states'
import { listContracts } from '@/lib/data/contracts'

export const metadata = { title: 'Pelanggan — G-CME' }

export default async function PelangganPage() {
  const contracts = await listContracts()

  // High standing with unresolved complaints: relationships that are quietly at risk.
  const quietlyAtRisk = contracts.filter((c) => c.rfmStatus === 'HIGH' && c.openCaseCount > 0)

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Pelanggan</h1>
        <p className="mt-1 text-sm text-gray-600">
          {contracts.length} pelanggan dalam cakupan Anda, masing-masing dengan satu kontrak.
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
            {quietlyAtRisk.map((contract) => (
              <li key={contract.id}>
                <Link
                  href={`/pelanggan/${contract.customerId}`}
                  className="inline-block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:text-primary"
                >
                  {contract.customerName} · {contract.openCaseCount} kasus
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contracts.length === 0 ? (
        <EmptyState
          judul="Belum ada pelanggan dalam cakupan Anda"
          keterangan="Tidak ada pelanggan yang terdaftar untuk cakupan akses Anda."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contracts.map((contract) => (
            <li key={contract.customerId}>
              <Link
                href={`/pelanggan/${contract.customerId}`}
                className="card-hover block h-full rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-900">{contract.customerName}</p>
                  <RfmBadge status={contract.rfmStatus} />
                </div>
                <p className="mb-3 text-xs text-gray-500">
                  {contract.customerId} · {contract.businessLine}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={contract.status} />
                  <GpmIndicator margin={contract.margin} />
                </div>
                {contract.openCaseCount > 0 ? (
                  <p className="mt-2.5 text-xs font-semibold text-red-700">
                    {contract.openCaseCount} kasus layanan terbuka
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
