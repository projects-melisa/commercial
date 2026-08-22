import { ContractTable } from '@/components/contracts/contract-table'
import { EmptyState } from '@/components/ui/states'
import { requireGrant, scopeLabel } from '@/lib/auth'
import { listContracts } from '@/lib/data/contracts'

export const metadata = { title: 'Kontrak — Gapura Commercial' }

export default async function KontrakPage() {
  const { profile } = await requireGrant('kontrak', 'view')
  const contracts = await listContracts()

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">Daftar Kontrak</h1>
        <p className="mt-1 text-sm text-gray-600">
          {contracts.length} kontrak pada {scopeLabel(profile)}.
        </p>
        </div>
</header>

      {contracts.length === 0 ? (
        <EmptyState
          judul="Belum ada kontrak dalam cakupan Anda"
          keterangan="Tidak ada kontrak yang terdaftar untuk cakupan akses Anda saat ini."
        />
      ) : (
        <section className="rounded-xl border border-gray-200 bg-white">
          <ContractTable contracts={contracts} />
        </section>
      )}
    </div>
  )
}
