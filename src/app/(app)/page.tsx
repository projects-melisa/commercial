import Link from 'next/link'
import { AlertTriangle, FileText, Percent, Target, TimerReset, Wallet } from 'lucide-react'

import { CompositionBar, ExpiryTimeline, MarginHistogram, StatusDonut } from '@/components/dashboard/charts'
import { StatCard } from '@/components/dashboard/stat-card'
import { ContractTable } from '@/components/contracts/contract-table'
import { EmptyState } from '@/components/ui/states'
import { requireProfile, scopeLabel } from '@/lib/auth'
import {
  countBy,
  expiryTimeline,
  marginDistribution,
  statusDistribution,
} from '@/lib/data/analytics'
import { listContracts, summarise } from '@/lib/data/contracts'
import { formatPercent, formatRupiahCompact } from '@/lib/domain'

export const metadata = { title: 'Dashboard — Gapura Commercial' }

export default async function DashboardPage() {
  const profile = await requireProfile()
  const contracts = await listContracts()
  const summary = summarise(contracts)

  // Scope follows the profile's business line and station, not the role: a user
  // confined to neither covers the whole portfolio just as a VP does.
  const scope = scopeLabel(profile)

  if (contracts.length === 0) {
    return (
      <EmptyState
        judul="Belum ada kontrak dalam cakupan Anda"
        keterangan={`Tidak ada kontrak yang terdaftar untuk ${scope}. Ini bukan kesalahan sistem — cakupan Anda memang kosong.`}
      />
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-extrabold text-gray-900 sm:text-2xl">
          Selamat datang, {profile.nama}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Ringkasan portofolio untuk {scope} — {summary.totalContracts} kontrak.
        </p>
      </header>

      {/* Every figure below is computed from exactly the rows this session can see,
          so they always agree with the table further down the page. */}
      {/* Six across only once there is room for it. At xl the cards were narrow enough
          that a two-word label wrapped to three lines and dropped its value out of line
          with its neighbours. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <StatCard
          label="Total Kontrak"
          value={String(summary.totalContracts)}
          keterangan={scope}
          icon={FileText}
        />
        <StatCard
          label="Jatuh Tempo ≤ 60 Hari"
          value={String(summary.dueWithin60Days)}
          keterangan="beban kerja renewal"
          icon={TimerReset}
          tone={summary.dueWithin60Days > 0 ? 'warn' : 'good'}
        />
        <StatCard
          label="Sudah Lewat Tempo"
          value={String(summary.expired)}
          keterangan="perlu tindakan segera"
          icon={AlertTriangle}
          tone={summary.expired > 0 ? 'bad' : 'good'}
        />
        <StatCard
          label="Rata-rata GPM"
          value={formatPercent(summary.averageGpm)}
          keterangan="seluruh kontrak terlihat"
          icon={Percent}
        />
        <StatCard
          label="Di Bawah Target"
          value={String(summary.belowTarget)}
          keterangan="terhadap target masing-masing"
          icon={Target}
          tone={summary.belowTarget > 0 ? 'bad' : 'good'}
        />
        {/* Only contracts carrying a volume can have a revenue, so the card says how
            much of the book it covers rather than implying it covers all of it. */}
        <StatCard
          label="Total Pendapatan"
          value={
            summary.withVolume === 0 ? '—' : formatRupiahCompact(summary.totalRevenue)
          }
          keterangan={
            summary.withVolume === 0
              ? 'belum ada volume tercatat'
              : `dari ${summary.withVolume} dari ${summary.totalContracts} kontrak bervolume`
          }
          icon={Wallet}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatusDonut data={statusDistribution(contracts)} />
        <CompositionBar
          judul="Komposisi per Lini Bisnis"
          ringkasan={countBy(contracts, (c) => c.businessLine)
            .map((d) => `${d.name}: ${d.value} kontrak`)
            .join('. ')}
          data={countBy(contracts, (c) => c.businessLine)}
        />
        <CompositionBar
          judul="Komposisi per Jenis Layanan"
          ringkasan={countBy(contracts, (c) => c.serviceType ?? 'Tanpa jenis layanan')
            .map((d) => `${d.name}: ${d.value} kontrak`)
            .join('. ')}
          data={countBy(contracts, (c) => c.serviceType ?? 'Tanpa jenis layanan')}
        />
        <ExpiryTimeline data={expiryTimeline(contracts)} />
        <MarginHistogram data={marginDistribution(contracts)} />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-bold text-gray-900">Kontrak Paling Mendesak</h2>
          <Link
            href="/kontrak"
            className="text-sm font-semibold text-primary hover:text-primary-light"
          >
            Lihat semua kontrak
          </Link>
        </div>
        <ContractTable contracts={contracts.slice(0, 8)} showFilters={false} />
      </section>
    </div>
  )
}
