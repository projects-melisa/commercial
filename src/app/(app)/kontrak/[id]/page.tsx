import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertCircle, ArrowLeft, Gavel, Receipt, Scale, ShieldOff, TrendingUp } from 'lucide-react'

import { KeputusanForm } from '@/app/(app)/kontrak/[id]/decision-form'
import { listKeputusan } from '@/app/(app)/kontrak/[id]/keputusan-actions'
import { GpmIndicator, RfmBadge, StatusBadge } from '@/components/ui/badges'
import { may, requireGrant, type Grants } from '@/lib/auth'
import { getContract, listCasesForCustomer } from '@/lib/data/contracts'
import { riskFor } from '@/lib/data/domains'
import {
  formatPercent,
  formatPercentagePoints,
  formatTarget,
  formatRupiah,
  formatSisaHari,
  formatVolume,
  grossProfit,
  formatTanggal,
} from '@/lib/domain'

export const metadata = { title: 'Detail Kontrak — Gapura Commercial' }

/** Who may hold the pen: `input` (commercial) records, `approve` (vp) does too. */
const mayDecide = (grants: Grants): boolean =>
  grants.has('keputusan:input') || grants.has('keputusan:approve')

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
  const { profile, grants } = await requireGrant('kontrak', 'view')
  const contract = await getContract(id)

  // A contract outside the caller's business line is not visible to their session at
  // all, so it is genuinely not found rather than forbidden.
  if (!contract) notFound()

  // Same rule as the receivable and penalty blocks below: ask for the grant before
  // asking the database. Without it RLS returns nothing, and "no cases on file" would
  // be indistinguishable from "you are not the one who gets to know" — which is a
  // worse answer than saying so, because it reads as reassurance.
  const seesCases = may(grants, 'irregularities', 'view')
  const cases = seesCases ? await listCasesForCustomer(contract.customerId) : []
  const openCases = cases.filter((c) => c.status === 'OPEN')

  // COMMERSIL.docx asks for the customer's receivable and penalty standing right here,
  // where the renewal decision is taken. A figure kept one page away is a figure nobody
  // checks — which is the manual chase across five systems this product exists to end.
  //
  // The grants are consulted before the query rather than after: RLS returns zero rows
  // to a caller without them, and "owes nothing" must not look like "not allowed to
  // know". The block is absent instead.
  const seesPiutang = may(grants, 'piutang', 'view')
  const seesPenalty = may(grants, 'penalty', 'view')
  const risk = seesPiutang || seesPenalty ? await riskFor(contract.customerId) : null

  // U-1 · the decision itself. Ask the grant first — silence must read as "yours to
  // know", not as "no decision was ever taken".
  const seesKeputusan = may(grants, 'keputusan', 'view')
  const keputusan = seesKeputusan ? await listKeputusan(contract.id) : []

  return (
    <div className="space-y-5">
      <Link
        href="/kontrak"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-primary"
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
          <p className="mt-1 text-sm text-gray-600">
            {contract.customerId} · {contract.businessLine} · {contract.serviceType}
            {contract.cabang ? ` · Cabang ${contract.cabang}` : ''}
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
          {/* Not a permission message: nobody may edit a contract here, whatever
              their role. Contracts are maintained in the Google Sheet and arrive
              through the daily pull, so saying "your role cannot" would send someone
              looking for the role that can. */}
          <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-500">
            <ShieldOff size={15} aria-hidden="true" />
            Kontrak diubah di Google Sheet, bukan di sini
          </span>
        </div>
      </header>

      {risk ? (
        <section className="grid gap-3 sm:grid-cols-2">
          {seesPiutang ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Receipt size={15} className="text-gray-400" aria-hidden="true" />
                Ringkasan piutang
              </h2>
              {risk.piutangStatus === null ? (
                <p className="mt-2 text-sm text-gray-400">
                  Pelanggan ini tidak ada di Receivable_Data.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums text-gray-900">
                    {formatRupiah(risk.piutangTotal)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Status{' '}
                    <span
                      className={
                        risk.piutangStatus === 'OPEN' ? 'font-semibold text-sem-warn' : 'text-gray-600'
                      }
                    >
                      {risk.piutangStatus}
                    </span>
                    . <Link href="/piutang" className="text-primary hover:underline">Lihat aging</Link>
                  </p>
                </>
              )}
            </div>
          ) : null}

          {seesPenalty ? (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                <Gavel size={15} className="text-gray-400" aria-hidden="true" />
                Ringkasan penalty
              </h2>
              {risk.penaltyCount === 0 ? (
                <p className="mt-2 text-sm text-gray-400">Belum ada penalty tercatat.</p>
              ) : (
                <>
                  <p className="mt-2 text-2xl font-extrabold tabular-nums text-gray-900">
                    {formatRupiah(risk.penaltyNilai)}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {risk.penaltyCount} kasus,{' '}
                    <span className={risk.penaltyTerbuka > 0 ? 'font-semibold text-sem-warn' : ''}>
                      {risk.penaltyTerbuka} belum ditutup
                    </span>
                    . <Link href="/penalty" className="text-primary hover:underline">Lihat semua</Link>
                  </p>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

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

      {seesKeputusan ? (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Scale size={15} className="text-gray-400" aria-hidden="true" />
            Keputusan Perpanjangan
          </h2>
          {keputusan.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">
              Belum ada keputusan tercatat. Tanpa satu pun, "sudah diputuskan" tidak bisa
              dibuktikan kepada siapa pun.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {keputusan.map((row) => (
                <li key={row.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                  <span
                    className={`mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      row.keputusan === 'renew'
                        ? 'bg-green-100 text-green-800'
                        : row.keputusan === 'no_renew'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-sem-warn'
                    }`}
                  >
                    {{ renew: 'PERPANJANG', no_renew: 'BERHENTI', renegosiasi: 'RENEGOSIASI' }[row.keputusan] ?? row.keputusan}
                  </span>
                  {row.alasan}
                  <span className="ml-1 text-xs text-gray-400">— {row.olehNama}</span>
                </li>
              ))}
            </ul>
          )}
          {mayDecide(grants) ? (
            <KeputusanForm contractId={contract.id} />
          ) : (
            <p className="mt-3 text-xs text-gray-400">
              Pencatatan dipegang Commercial (dan VP). Peran Anda melihat keputusannya saja.
            </p>
          )}
        </section>
      ) : null}

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
            <Field label="Target GPM Kontrak Ini">{formatTarget(contract.minGpmTarget)}</Field>
            <Field label="Selisih terhadap Target">
              {contract.margin.delta === null ? (
                <span className="font-normal text-gray-400">Perlu target</span>
              ) : (
                <span className={contract.margin.meetsTarget ? 'text-green-700' : 'text-red-700'}>
                  {formatPercentagePoints(contract.margin.delta)}
                </span>
              )}
            </Field>
          </dl>

          {contract.margin.meetsTarget === false ? (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              Kontrak ini berada di bawah target marginnya sendiri
              {' '}({formatPercent(contract.margin.gpm)} terhadap{' '}
              {formatTarget(contract.minGpmTarget)}). Gunakan simulator untuk mencari tarif
              minimum yang memenuhi target.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-gray-900">Kasus Layanan</h2>
          {seesCases ? (
            <p className="mb-4 text-xs text-gray-500">
              {openCases.length > 0
                ? `${openCases.length} kasus terbuka — hal ini akan diangkat pelanggan saat negosiasi.`
                : 'Tidak ada kasus terbuka.'}
            </p>
          ) : null}

          {!seesCases ? (
            <p className="text-sm text-gray-400">
              Irregularities dipegang OCS KPS. Peran Anda tidak menerima datanya, jadi halaman ini
              tidak bisa menyatakan pelanggan ini punya kasus atau tidak — hubungi OCS sebelum
              memutuskan perpanjangan. Ini konsekuensi yang dicatat sebagai R-01, bukan kesalahan
              sistem.
            </p>
          ) : cases.length === 0 ? (
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

    </div>
  )
}
