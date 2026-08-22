import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, CircleCheck, TimerReset, Wallet } from 'lucide-react'

import { AgingMatrix } from '@/components/dashboard/aging-matrix'
import { CaseList } from '@/components/dashboard/case-list'
import {
  DonutCard,
  LIFECYCLE_COLORS,
  RECEIVABLE_COLORS,
  RFM_COLORS,
  STATUS_COLORS,
} from '@/components/dashboard/charts'
import { MonitorTable, type MonitorRow } from '@/components/dashboard/monitor-table'
import { MetricCard } from '@/components/dashboard/stat-card'
import { EmptyState } from '@/components/ui/states'
import { may, requireGrant, scopeLabel } from '@/lib/auth'
import { lifecycleDistribution, rfmDistribution, statusDistribution } from '@/lib/data/analytics'
import { listContracts, summarise } from '@/lib/data/contracts'
import {
  agingMatrix,
  listIrregularities,
  listReceivables,
  receivableStatusSplit,
  totalReceivable,
} from '@/lib/data/domains'
import { formatRupiahCompact } from '@/lib/domain'

export const metadata = { title: 'Dashboard — Gapura Commercial' }

/** One panel of the dashboard: a titled white card with an optional action on the right. */
const Panel = ({
  judul,
  keterangan,
  aksi,
  delay = 0,
  children,
}: {
  judul: string
  keterangan?: string
  aksi?: React.ReactNode
  delay?: number
  children: React.ReactNode
}) => (
  <section
    className="dash-rise overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 sm:px-5">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{judul}</h2>
        {keterangan ? <p className="mt-0.5 text-xs text-gray-500">{keterangan}</p> : null}
      </div>
      {aksi}
    </div>
    {children}
  </section>
)

const PanelLink = ({ href, label }: { href: '/kontrak' | '/piutang' | '/irregularities'; label: string }) => (
  <Link
    href={href}
    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-light"
  >
    {label}
    <ArrowUpRight size={14} aria-hidden="true" />
  </Link>
)

export default async function DashboardPage() {
  const { profile, grants } = await requireGrant('kontrak', 'view')

  // Both grants are asked before the query, not after: RLS hands a caller without one
  // an empty array, and "nothing owed" and "not yours to know" render identically
  // unless the page knows which it is looking at. Silence reads as reassurance.
  const bolehPiutang = may(grants, 'piutang', 'view')
  const bolehIrregularities = may(grants, 'irregularities', 'view')

  const [contracts, receivables, irregularities] = await Promise.all([
    listContracts(),
    bolehPiutang ? listReceivables() : Promise.resolve(null),
    bolehIrregularities ? listIrregularities() : Promise.resolve(null),
  ])

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

  const piutangStatusOf = new Map((receivables ?? []).map((row) => [row.customerId, row.status]))

  // A customer stands as OPEN the moment any one of their cases does — the standing a
  // renewal conversation has to account for is the worst one on file, not the average.
  const irregularityStatusOf = new Map<string, 'OPEN' | 'CLOSED'>()
  for (const kasus of irregularities ?? []) {
    if (kasus.status === 'OPEN' || !irregularityStatusOf.has(kasus.customerId)) {
      irregularityStatusOf.set(kasus.customerId, kasus.status)
    }
  }

  // `listContracts` already orders by end date, so the most urgent rows lead without
  // this page sorting again.
  const rows: MonitorRow[] = contracts.map((contract) => ({
    contract,
    piutangStatus: piutangStatusOf.get(contract.customerId) ?? null,
    irregularityStatus: irregularityStatusOf.get(contract.customerId) ?? null,
  }))

  const aktif = summary.totalContracts - summary.expired
  const aging = receivables ? agingMatrix(receivables) : null
  const kasusTerbuka = (irregularities ?? []).filter((k) => k.status === 'OPEN').length

  return (
    <div className="space-y-4">
      <header className="dash-hero dash-rise relative overflow-hidden rounded-2xl">
        <div className="dash-hero-grid absolute inset-0" aria-hidden="true" />
        <div className="relative px-5 py-6 sm:px-7 sm:py-8">
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/60 uppercase">
            One Click Commercial
          </p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-white/70">
            Pemantauan kontrak dan simulator P&amp;L dinamis. Selamat datang, {profile.nama}.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1 text-white">{scope}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 text-white tabular-nums">
              {summary.totalContracts} kontrak
            </span>
            {bolehPiutang && receivables ? (
              <span className="rounded-full bg-white/15 px-3 py-1 text-white tabular-nums">
                Piutang {formatRupiahCompact(totalReceivable(receivables))}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Every figure below is computed from exactly the rows this session can see,
          so they always agree with the tables further down the page. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kontrak Aktif"
          value={String(aktif)}
          keterangan="masih berjalan hari ini"
          icon={CircleCheck}
          tone="good"
          delay={30}
        />
        <MetricCard
          label="Akan Berakhir"
          value={String(summary.dueWithin60Days)}
          keterangan="≤ 60 hari — beban kerja renewal"
          icon={TimerReset}
          tone={summary.dueWithin60Days > 0 ? 'warn' : 'good'}
          delay={60}
        />
        <MetricCard
          label="Sudah Expired"
          value={String(summary.expired)}
          keterangan="perlu tindakan segera"
          icon={AlertTriangle}
          tone={summary.expired > 0 ? 'bad' : 'good'}
          delay={90}
        />
        {/* Only contracts carrying a volume can have a revenue, so the card says how
            much of the book it covers rather than implying it covers all of it. */}
        <MetricCard
          label="Nilai Kontrak"
          value={summary.withVolume === 0 ? '—' : formatRupiahCompact(summary.totalRevenue)}
          keterangan={
            summary.withVolume === 0
              ? 'belum ada volume tercatat'
              : `dari ${summary.withVolume} dari ${summary.totalContracts} kontrak bervolume`
          }
          icon={Wallet}
          delay={120}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel
            judul="Pemantauan Kontrak"
            keterangan="Diurutkan dari tanggal berakhir terdekat."
            aksi={<PanelLink href="/kontrak" label="Semua kontrak" />}
            delay={140}
          >
            <MonitorTable
              rows={rows}
              showPiutang={bolehPiutang}
              showIrregularities={bolehIrregularities}
            />
          </Panel>

          {aging ? (
            <Panel
              judul="Aging Piutang"
              keterangan={`Akumulasi ${formatRupiahCompact(totalReceivable(receivables!))} dari ${receivables!.length} pelanggan.`}
              aksi={<PanelLink href="/piutang" label="Rincian piutang" />}
              delay={170}
            >
              <AgingMatrix rows={aging.rows} total={aging.total} />
            </Panel>
          ) : null}

          {irregularities && irregularities.length > 0 ? (
            <Panel
              judul="Irregularities"
              keterangan={`${kasusTerbuka} dari ${irregularities.length} kasus masih terbuka.`}
              aksi={<PanelLink href="/irregularities" label="Semua kasus" />}
              delay={200}
            >
              <CaseList cases={irregularities} />
            </Panel>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="dash-rise" style={{ animationDelay: '150ms' }}>
            <DonutCard
              judul="Segmentasi Pelanggan"
              keterangan="Standing RFM pada kontrak yang terlihat."
              data={rfmDistribution(contracts)}
              colors={RFM_COLORS}
            />
          </div>
          <div className="dash-rise" style={{ animationDelay: '180ms' }}>
            <DonutCard
              judul="Kontrak"
              keterangan="Aktif terhadap yang sudah lewat tempo."
              data={lifecycleDistribution(contracts)}
              colors={LIFECYCLE_COLORS}
            />
          </div>
          <div className="dash-rise" style={{ animationDelay: '210ms' }}>
            {receivables && receivables.length > 0 ? (
              <DonutCard
                judul="Piutang"
                keterangan="Status penagihan per pelanggan."
                data={receivableStatusSplit(receivables)}
                colors={RECEIVABLE_COLORS}
                satuan="pelanggan"
                entityLabel="Pelanggan"
              />
            ) : (
              <DonutCard
                judul="Status Kontrak"
                keterangan="Sebaran band status di seluruh cakupan."
                data={statusDistribution(contracts)}
                colors={STATUS_COLORS}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
