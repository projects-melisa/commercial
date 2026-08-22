import { Activity, Package, Target, TrendingDown, TrendingUp, Wallet } from 'lucide-react'

import { StatCard } from '@/components/dashboard/stat-card'
import {
  GapCabang,
  Komposisi,
  TrenBulanan,
  TrenHarian,
  TrenKumulatif,
} from '@/components/revenue/charts'
import { Ach, Ranking, Signed } from '@/components/revenue/tables'
import { YieldTable } from '@/app/(app)/pendapatan/yield-table'
import {
  bulananFor,
  DIMENSI,
  harianFor,
  punyaHarian,
  komposisi,
  kpiFor,
  kumulatifFor,
  peringkatBy,
  toneFor,
  type DimensiKey,
  type RevenueRow,
} from '@/lib/data/revenue'
import { formatMeasure, formatPercent, type Measure } from '@/lib/domain'

/**
 * The four Overview sub-tabs.
 *
 * They differ in three ways at once, because four copies of one dashboard is four
 * chances to read the same number and think you learned something new:
 *
 *   - **what is counted** — rupiah on the revenue tabs, units on the production ones;
 *   - **how it is cut** — the plain tabs rank by `group 1 GL`, the Unit Pelaporan tabs
 *     roll up to `group 2 GL` and drill into `group 3 GL`, which is the column the
 *     client's own UP dashboards use;
 *   - **the panel that only that tab has** — composition, yield, P/L classification,
 *     or the customer league table.
 */

export interface SubTab {
  slug: string
  label: string
  measure: Measure
  satuan: string
  sumber: string
  ringkas: string
}

export const OVERVIEW_SUBS: readonly SubTab[] = [
  {
    slug: 'revenue',
    label: 'Revenue',
    measure: 'rupiah',
    satuan: 'Rupiah',
    sumber: 'Ancillary_Data · IMS, Daily Report GPL, Rekap Manual Cabang',
    ringkas: 'Pendapatan terhadap RKAP, dipecah per Line of Business.',
  },
  {
    slug: 'production',
    label: 'Production',
    measure: 'unit',
    satuan: 'unit produksi',
    sumber: 'Ancillary_Data · IMS, Daily Report GPL, Rekap Manual Cabang',
    ringkas: 'Volume produksi terhadap RKAP, dan berapa rupiah yang dihasilkan tiap unitnya.',
  },
  {
    slug: 'revenue-up',
    label: 'Revenue (UP)',
    measure: 'rupiah',
    satuan: 'Rupiah',
    sumber: 'Unit Pelaporan',
    ringkas: 'Pendapatan pada level Unit Pelaporan: rollup group 2 GL, bukan per LoB.',
  },
  {
    slug: 'production-up',
    label: 'Production (UP)',
    measure: 'unit',
    satuan: 'unit produksi',
    sumber: 'Unit Pelaporan',
    ringkas: 'Produksi pada level Unit Pelaporan, dengan peringkat pelanggan.',
  },
]

const isUp = (slug: string): boolean => slug.endsWith('-up')

export const OverviewPanel = ({
  sub,
  rows,
  tahun,
}: {
  sub: SubTab
  rows: RevenueRow[]
  tahun: number
}) => {
  const { measure } = sub
  const format = (value: number): string => formatMeasure(measure, value)

  const kpi = kpiFor(rows, tahun, measure)
  const bulanan = bulananFor(rows, tahun, measure)
  const kumulatif = kumulatifFor(bulanan)
  // A per-unit tab has no meaningful daily total — a ratio cannot be summed across
  // days — so the rhythm chart is shown only where the measure is additive.
  const harian = sub.measure === 'perUnit' ? [] : harianFor(rows, tahun, measure)

  // The headline dimension is the difference between a plain tab and a UP one. Kept as
  // a `DIMENSI` key, not the accessor itself, past this point — a function prop cannot
  // cross into the client components below.
  const utamaKey: DimensiKey = isUp(sub.slug) ? 'group2' : 'lob'
  const utama = DIMENSI[utamaKey]
  const utamaLabel = isUp(sub.slug) ? 'group 2 GL' : 'Line of Business'

  const byUtama = peringkatBy(rows, tahun, measure, utama)
  const byCabang = peringkatBy(rows, tahun, measure, DIMENSI.cabang)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="RKAP" value={format(kpi.rkap)} icon={Target} />
        <StatCard label="Aktual" value={format(kpi.aktual)} icon={Wallet} />
        <StatCard
          label="Diff"
          value={kpi.diff < 0 ? `(${format(Math.abs(kpi.diff))})` : format(kpi.diff)}
          keterangan="Aktual − RKAP"
          icon={kpi.diff < 0 ? TrendingDown : TrendingUp}
          tone={kpi.diff < 0 ? 'bad' : 'good'}
        />
        <StatCard
          label="%Ach"
          value={kpi.ach === null ? '—' : formatPercent(kpi.ach)}
          keterangan="Aktual ÷ RKAP"
          icon={Activity}
          tone={toneFor(kpi.ach)}
        />
        <StatCard
          label="%YoY"
          value={kpi.yoy === null ? '—' : formatPercent(kpi.yoy)}
          keterangan={`Terhadap aktual ${tahun - 1}: ${format(kpi.sebelumnya)}`}
          icon={Package}
          tone={kpi.yoy === null ? 'neutral' : kpi.yoy < 0 ? 'bad' : 'good'}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TrenBulanan
          data={bulanan}
          rows={rows}
          tahun={tahun}
          measure={measure}
          judul={`Tren bulanan ${tahun} — ${sub.satuan}`}
        />
        <TrenKumulatif data={kumulatif} rows={rows} tahun={tahun} measure={measure} />
      </div>

      {harian.length > 0 && punyaHarian(rows) ? (
        <TrenHarian data={harian} rows={rows} tahun={tahun} measure={measure} />
      ) : null}

      <Komposisi
        data={komposisi(rows, tahun, measure, utama)}
        rows={rows}
        tahun={tahun}
        dimensiKey={utamaKey}
        measure={measure}
        judul={`Komposisi aktual ${tahun} menurut ${utamaLabel}`}
      />

      <Ranking
        judul={`Peringkat ${utamaLabel}`}
        keterangan={
          isUp(sub.slug)
            ? 'Rollup Unit Pelaporan. Tab Revenue dan Production memecah angka yang sama per LoB.'
            : 'Pecahan per LoB. Tab (UP) menggulungnya ke level Unit Pelaporan.'
        }
        kolom={utamaLabel}
        baris={byUtama}
        measure={measure}
        tahun={tahun}
        rows={rows}
        dimensiKey={utamaKey}
      />

      {/* The panel that only this tab has. */}
      {sub.slug === 'revenue' ? (
        <Ranking
          judul="Peringkat pelanggan"
          keterangan="Siapa yang membayar, terhadap anggaran masing-masing."
          kolom="Pelanggan"
          baris={peringkatBy(rows, tahun, measure, DIMENSI.customer)}
          measure={measure}
          tahun={tahun}
          rows={rows}
          dimensiKey="customer"
        />
      ) : null}

      {sub.slug === 'production' ? <YieldTable rows={rows} tahun={tahun} /> : null}

      {sub.slug === 'revenue-up' ? (
        <Ranking
          judul="Klasifikasi P&L"
          keterangan="Kolom `text P/L` — bagaimana pendapatan ini masuk ke laporan laba rugi."
          kolom="text P/L"
          baris={peringkatBy(rows, tahun, measure, DIMENSI.textPl)}
          measure={measure}
          tahun={tahun}
          rows={rows}
          dimensiKey="textPl"
        />
      ) : null}

      {sub.slug === 'production-up' ? (
        <Ranking
          judul="Peringkat pelanggan"
          keterangan="Volume per pelanggan pada level Unit Pelaporan."
          kolom="Pelanggan"
          baris={peringkatBy(rows, tahun, measure, DIMENSI.customer)}
          measure={measure}
          tahun={tahun}
          rows={rows}
          dimensiKey="customer"
        />
      ) : null}

      <Ranking
        judul={isUp(sub.slug) ? 'Peringkat group 3 GL' : 'Peringkat cabang'}
        keterangan={
          isUp(sub.slug)
            ? 'Turunan satu tingkat di bawah group 2 GL.'
            : 'Per bandara, terhadap anggaran cabang masing-masing.'
        }
        kolom={isUp(sub.slug) ? 'group 3 GL' : 'Cabang'}
        baris={isUp(sub.slug) ? peringkatBy(rows, tahun, measure, DIMENSI.group3) : byCabang}
        measure={measure}
        tahun={tahun}
        rows={rows}
        dimensiKey={isUp(sub.slug) ? 'group3' : 'cabang'}
      />

      {byCabang.length > 1 ? (
        <GapCabang
          data={byCabang.map((row) => ({ nama: row.nama, diff: row.diff }))}
          rows={rows}
          tahun={tahun}
          measure={measure}
        />
      ) : null}
    </>
  )
}

export { Ach, Signed }
