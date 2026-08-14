import Link from 'next/link'
import { AlertTriangle, ArrowRight, Check, MessageSquareWarning } from 'lucide-react'

import { markFollowedUp } from '@/app/(app)/kritis/actions'
import { SendReminderButton } from '@/app/(app)/kritis/send-reminder-button'
import { GpmIndicator, RfmBadge } from '@/components/ui/badges'
import { EmptyState } from '@/components/ui/states'
import { listContracts } from '@/lib/data/contracts'
import { buildCriticalQueue, type CriticalEntry } from '@/lib/data/critical'
import { formatSisaHari, formatTanggal } from '@/lib/domain'

export const metadata = { title: 'Kontrak Kritis — Gapura Commercial' }

const Band = ({
  judul,
  keterangan,
  entries,
  tone,
}: {
  judul: string
  keterangan: string
  entries: CriticalEntry[]
  tone: 'nonaktif' | 'kritis' | 'perhatian'
}) => {
  const tones = {
    nonaktif: 'border-gray-300 bg-gray-50',
    kritis: 'border-red-200 bg-red-50',
    perhatian: 'border-amber-200 bg-amber-50',
  } as const

  if (entries.length === 0) return null

  return (
    <section>
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          {judul}
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
            {entries.length}
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">{keterangan}</p>
      </div>

      <ul className="space-y-3">
        {entries.map(({ contract, alasan, tindakan }) => (
          <li key={contract.id} className={`rounded-xl border p-4 ${tones[tone]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/kontrak/${contract.id}`}
                    className="font-bold text-gray-900 hover:text-primary"
                  >
                    {contract.customerName}
                  </Link>
                  <RfmBadge status={contract.rfmStatus} />
                  <GpmIndicator margin={contract.margin} />
                  {contract.openCaseCount > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-200 px-2 py-0.5 text-xs font-semibold text-red-900">
                      <MessageSquareWarning size={11} aria-hidden="true" />
                      {contract.openCaseCount} kasus terbuka
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-gray-500">
                  {contract.businessLine} · {contract.serviceType} ·{' '}
                  {formatTanggal(contract.contractEndDate)} · {formatSisaHari(contract.daysLeft)}
                </p>

                <p className="mt-2 text-sm text-gray-700">
                  <span className="font-semibold">Mengapa perlu perhatian: </span>
                  {alasan}
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-semibold text-primary">
                  <ArrowRight size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {tindakan}
                </p>
                {contract.followedUpAt ? (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded bg-white/70 px-2 py-0.5 text-xs font-semibold text-gray-600">
                    <Check size={12} aria-hidden="true" />
                    Ditindaklanjuti {formatTanggal(contract.followedUpAt)}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-2">
                <Link
                  href={`/simulator/${contract.id}`}
                  className="rounded-lg bg-primary px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-primary-light"
                >
                  Simulasikan
                </Link>
                <SendReminderButton contractId={contract.id} />
                {/* A plain form: a server action needs no client component here. */}
                <form action={markFollowedUp}>
                  <input type="hidden" name="contract_id" value={contract.id} />
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary"
                  >
                    {contract.followedUpAt ? 'Tindak lanjut lagi' : 'Tandai ditindaklanjuti'}
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default async function KritisPage() {
  const contracts = await listContracts()
  const queue = buildCriticalQueue(contracts)
  const total = queue.nonaktif.length + queue.kritis.length + queue.perluPerhatian.length

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 sm:text-2xl">
          <AlertTriangle className="text-amber-600" size={22} aria-hidden="true" />
          Kontrak Kritis
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {total} kontrak mendekati atau melewati tanggal berakhir, diurutkan dari yang paling
          mendesak.
        </p>
      </header>

      {total === 0 ? (
        <EmptyState
          judul="Tidak ada kontrak yang mendesak"
          keterangan="Semua kontrak dalam cakupan Anda masih berada di atas 60 hari menuju tanggal berakhir."
        />
      ) : (
        <div className="space-y-8">
          <Band
            judul="Sudah Lewat Tempo"
            keterangan="Ditampilkan terpisah agar tidak menutupi kontrak yang masih bisa diselamatkan."
            entries={queue.nonaktif}
            tone="nonaktif"
          />
          <Band
            judul="Kritis"
            keterangan="14 hari atau kurang menuju tanggal berakhir."
            entries={queue.kritis}
            tone="kritis"
          />
          <Band
            judul="Perlu Perhatian"
            keterangan="15 sampai 60 hari menuju tanggal berakhir."
            entries={queue.perluPerhatian}
            tone="perhatian"
          />
        </div>
      )}
    </div>
  )
}
