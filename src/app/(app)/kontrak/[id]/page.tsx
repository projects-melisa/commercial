import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertCircle, ArrowLeft, ShieldOff, TrendingUp } from 'lucide-react'

import { EditContractForm } from '@/app/(app)/kontrak/[id]/edit-contract-form'
import { GpmIndicator, RfmBadge, StatusBadge } from '@/components/ui/badges'
import { canEditContracts, requireProfile } from '@/lib/auth'
import { getContract, listCasesForCustomer } from '@/lib/data/contracts'
import {
  formatPercent,
  formatPercentagePoints,
  formatRupiah,
  formatSisaHari,
  formatVolume,
  grossProfit,
  formatTanggal,
} from '@/lib/domain'

export const metadata = { title: 'Detail Kontrak — G-CME' }

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</dt>
    <dd className="mt-1 text-sm font-semibold text-gray-900">{children}</dd>
  </div>
)

export default async function KontrakDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await requireProfile()
  const contract = await getContract(id)

  // A contract outside the caller's business line is not visible to their session at
  // all, so it is genuinely not found rather than forbidden.
  if (!contract) notFound()

  const cases = await listCasesForCustomer(contract.customerId)
  const openCases = cases.filter((c) => c.status === 'OPEN')
  const canEdit = canEditContracts(profile)

  return (
    <div className="space-y-5">
      <Link
        href="/kontrak"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-primary"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Kembali ke daftar kontrak
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
              {contract.customerName}
            </h1>
            <StatusBadge status={contract.status} />
            <RfmBadge status={contract.rfmStatus} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {contract.customerId} · {contract.businessLine} · {contract.serviceType}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/simulator/${contract.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-light"
          >
            <TrendingUp size={15} aria-hidden="true" />
            Buka Simulator
          </Link>
          {canEdit ? null : (
            <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-500">
              <ShieldOff size={15} aria-hidden="true" />
              Peran VP tidak dapat mengubah data
            </span>
          )}
        </div>
      </header>

      {/* Time remaining leads, because it is what decides whether anything else on
          this page still matters. */}
      <section
        className={`rounded-xl border p-5 ${
          contract.daysLeft < 0
            ? 'border-gray-300 bg-gray-50'
            : contract.daysLeft <= 14
              ? 'border-red-200 bg-red-50'
              : contract.daysLeft <= 60
                ? 'border-amber-200 bg-amber-50'
                : 'border-green-200 bg-green-50'
        }`}
      >
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Sisa Waktu">
            <span className="text-lg">{formatSisaHari(contract.daysLeft)}</span>
          </Field>
          <Field label="Tanggal Berakhir">
            {formatTanggal(contract.contractEndDate)}
            {contract.previousEndDate ? (
              <span className="mt-0.5 block text-xs font-normal text-gray-500">
                Diperpanjang dari {formatTanggal(contract.previousEndDate)}
              </span>
            ) : null}
          </Field>
          <Field label="Status">{contract.status}</Field>
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-gray-900">Posisi Komersial</h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Tarif">{formatRupiah(contract.tarif)}</Field>
            <Field label="Cost">{formatRupiah(contract.cost)}</Field>
            <Field label="Gross Profit">{formatRupiah(grossProfit(contract.tarif, contract.cost))}</Field>
            <Field label="GPM Saat Ini">
              <GpmIndicator margin={contract.margin} />
            </Field>
            <Field label="Volume">
              {contract.volume === null ? (
                <span className="font-normal text-gray-400">Belum dicatat</span>
              ) : (
                formatVolume(contract.volume, contract.businessLine)
              )}
            </Field>
            <Field label="Pendapatan">
              {contract.revenue === null ? (
                <span className="font-normal text-gray-400">Perlu volume</span>
              ) : (
                formatRupiah(contract.revenue)
              )}
            </Field>
            <Field label="Target GPM Kontrak Ini">{formatPercent(contract.minGpmTarget)}</Field>
            <Field label="Selisih terhadap Target">
              <span className={contract.margin.meetsTarget ? 'text-green-700' : 'text-red-700'}>
                {formatPercentagePoints(contract.margin.delta)}
              </span>
            </Field>
          </dl>

          {!contract.margin.meetsTarget ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Kontrak ini berada di bawah target marginnya sendiri
              {' '}({formatPercent(contract.margin.gpm)} terhadap{' '}
              {formatPercent(contract.minGpmTarget)}). Gunakan simulator untuk mencari tarif
              minimum yang memenuhi target.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">Kasus Layanan</h2>
          <p className="mb-4 text-xs text-gray-500">
            {openCases.length > 0
              ? `${openCases.length} kasus terbuka — hal ini akan diangkat pelanggan saat negosiasi.`
              : 'Tidak ada kasus terbuka.'}
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canEdit ? <EditContractForm contract={contract} /> : null}
    </div>
  )
}
