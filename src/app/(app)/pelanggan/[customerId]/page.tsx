import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lightbulb } from 'lucide-react'

import { logCase, toggleCase } from '@/app/(app)/pelanggan/[customerId]/actions'
import { GpmIndicator, RfmBadge, StatusBadge } from '@/components/ui/badges'
import { canEditContracts, requireProfile } from '@/lib/auth'
import { listCasesForCustomer, listContracts } from '@/lib/data/contracts'
import type { ContractView } from '@/lib/data/contracts'
import {
  formatPercent,
  formatRupiah,
  formatSisaHari,
  formatTanggal,
  minimumTarifForTarget,
  formatTarget,
  NO_TARGET_LABEL,
} from '@/lib/domain'

export const metadata = { title: 'Detail Pelanggan — Gapura Commercial' }

/**
 * The recommendation combines the three things that decide how a renegotiation should
 * be approached: what the relationship is worth, whether the contract is earning its
 * target, and whether there is unresolved service history to answer for.
 */
const recommend = (contract: ContractView, openCases: number): string => {
  const pieces: string[] = []

  if (contract.rfmStatus === 'HIGH') {
    pieces.push('Pelanggan bernilai tinggi — prioritaskan mempertahankan hubungan.')
  } else if (contract.rfmStatus === 'LOW') {
    pieces.push('Nilai pelanggan rendah — perpanjangan hanya layak jika margin membaik.')
  } else {
    pieces.push('Nilai pelanggan menengah — pertahankan dengan syarat yang wajar.')
  }

  // No target, no verdict: a negotiating floor is derived from the target, so
  // without one there is nothing to advise beyond saying it is missing.
  if (contract.minGpmTarget === null) {
    pieces.push(
      `Target GPM kontrak ini ${NO_TARGET_LABEL}, sehingga posisi margin belum bisa dinilai. Tetapkan target di sumber data lebih dulu.`,
    )
  } else if (contract.margin.meetsTarget === false) {
    const floor = minimumTarifForTarget(contract.cost, contract.minGpmTarget)
    pieces.push(
      `Margin di bawah target: naikkan tarif ke minimal ${formatRupiah(floor)} atau turunkan cost sebelum memperpanjang.`,
    )
  } else {
    pieces.push(
      `Margin memenuhi target ${formatPercent(contract.minGpmTarget)}, sehingga ada ruang untuk bernegosiasi pada harga.`,
    )
  }

  if (openCases > 0) {
    pieces.push(
      `${openCases} kasus layanan masih terbuka — selesaikan lebih dulu, karena hal ini akan diangkat pelanggan sebagai daya tawar.`,
    )
  }

  if (contract.daysLeft < 0) {
    pieces.push('Kontrak sudah lewat tempo — tindakan hari ini, bukan minggu depan.')
  } else if (contract.daysLeft <= 14) {
    pieces.push('Waktu tersisa sangat singkat — jadwalkan pertemuan minggu ini.')
  }

  return pieces.join(' ')
}

export default async function PelangganDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>
}) {
  const { customerId } = await params
  const profile = await requireProfile()
  const canManageCases = canEditContracts(profile)
  const contracts = await listContracts()
  // Every contract this customer holds, not the first one found. They stopped being
  // 1:1 when the Sheet became the source of truth, and `find` was quietly dropping
  // Garuda Indonesia's cargo contract and both of Batik Air's station lines.
  const own = contracts
    .filter((c) => c.customerId === customerId)
    .sort((a, b) => a.daysLeft - b.daysLeft)
  if (own.length === 0) notFound()
  // The most urgent line leads: it is the one the recommendation is about.
  const contract = own[0]!

  const cases = await listCasesForCustomer(customerId)
  const openCases = cases.filter((c) => c.status === 'OPEN')

  return (
    <div className="space-y-5">
      <Link
        href="/pelanggan"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Kembali ke daftar pelanggan
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
            {contract.customerName}
          </h1>
          <RfmBadge status={contract.rfmStatus} />
          <StatusBadge status={contract.status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {contract.customerId} · {[...new Set(own.map((c) => c.businessLine))].join(' · ')} ·{' '}
          {own.length === 1 ? '1 kontrak' : `${own.length} baris kontrak`}
        </p>
      </header>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-900">
          <Lightbulb size={16} aria-hidden="true" />
          Rekomendasi
        </h2>
        <p className="text-sm leading-relaxed text-blue-900">
          {recommend(contract, openCases.length)}
        </p>
        {own.length > 1 ? (
          <p className="mt-2 text-xs text-blue-800">
            Berdasarkan kontrak paling mendesak
            {contract.contractNo ? ` (${contract.contractNo}` : ''}
            {contract.contractNo && contract.cabang ? ` · ${contract.cabang}` : ''}
            {contract.contractNo ? ')' : ''}. Kontrak lain pelanggan ini tercantum di bawah.
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {own.map((contract) => (
        <section key={contract.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">
            Kontrak &amp; Posisi Margin
            {contract.contractNo ? ` — ${contract.contractNo}` : ''}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {contract.businessLine} · {contract.cabang ?? 'Seluruh station'}
            {contract.serviceType ? ` · ${contract.serviceType}` : ''}
          </p>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Tarif</dt>
              <dd className="mt-1 font-semibold text-gray-900">{formatRupiah(contract.tarif)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Cost</dt>
              <dd className="mt-1 font-semibold text-gray-900">{formatRupiah(contract.cost)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">GPM</dt>
              <dd className="mt-1">
                <GpmIndicator margin={contract.margin} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Target GPM</dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {formatTarget(contract.minGpmTarget)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Berakhir</dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {formatTanggal(contract.contractEndDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-gray-500 uppercase">Sisa Waktu</dt>
              <dd className="mt-1 font-semibold text-gray-900">
                {formatSisaHari(contract.daysLeft)}
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex gap-2">
            <Link
              href={`/kontrak/${contract.id}`}
              className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary"
            >
              Detail kontrak
            </Link>
            <Link
              href={`/simulator/${contract.id}`}
              className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-white hover:bg-primary-light"
            >
              Simulasikan
            </Link>
          </div>
        </section>
        ))}

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">Riwayat Kasus Layanan</h2>
          <p className="mb-4 text-xs text-gray-500">
            {cases.length} kasus tercatat, {openCases.length} di antaranya masih terbuka.
          </p>

          {cases.length === 0 ? (
            <p className="text-sm text-gray-400">Belum ada kasus tercatat untuk pelanggan ini.</p>
          ) : (
            <ul className="space-y-2.5">
              {cases.map((serviceCase) => (
                <li
                  key={serviceCase.id}
                  className={`rounded-lg border px-3 py-2.5 text-sm ${
                    serviceCase.status === 'OPEN'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <span
                    className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      serviceCase.status === 'OPEN'
                        ? 'bg-red-200 text-red-900'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {serviceCase.status === 'OPEN' ? 'TERBUKA' : 'SELESAI'}
                  </span>
                  <p className="text-gray-700">{serviceCase.description}</p>
                  {canManageCases ? (
                    <form action={toggleCase} className="mt-1.5">
                      <input type="hidden" name="case_id" value={serviceCase.id} />
                      <input type="hidden" name="customer_id" value={customerId} />
                      <input type="hidden" name="status" value={serviceCase.status} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-gray-500 underline hover:text-primary"
                      >
                        {serviceCase.status === 'OPEN' ? 'Tandai selesai' : 'Buka kembali'}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canManageCases ? (
            <form action={logCase} className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
              <input type="hidden" name="customer_id" value={customerId} />
              <input
                name="description"
                required
                placeholder="Catat kasus layanan baru…"
                aria-label="Catat kasus layanan baru"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary-light"
              >
                Catat
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  )
}
