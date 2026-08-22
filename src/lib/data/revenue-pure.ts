import type { Measure } from '@/lib/domain'

/**
 * Everything about `Ancillary_Data` that has no Supabase dependency: the row shape,
 * the filters, and every derived figure a revenue chart or table computes.
 *
 * Split out from `revenue.ts` so a client component (a chart or table with a click
 * handler) can import `DIMENSI`, `yieldBy`, `peringkatBy` and friends without dragging
 * `listRevenue`'s `next/headers` import into the browser bundle — the same reason
 * `domains-constants.ts` exists beside `domains.ts`.
 */
export interface RevenueRow {
  cab: string
  plan_actual: string
  customer: string
  periode: string
  tahun: number
  production: number
  total: number
  group_1_gl: string | null
  group_2_gl: string | null
  group_3_gl: string | null
  text_pl: string | null
}

// ── Filters ─────────────────────────────────────────────────────────────────────

export interface RevenueFilter {
  tahun: number
  cab: string | null
  customer: string | null
  lob: string | null
}

export const applyFilter = (rows: RevenueRow[], filter: RevenueFilter): RevenueRow[] =>
  rows.filter(
    (row) =>
      (filter.cab === null || row.cab === filter.cab) &&
      (filter.customer === null || row.customer === filter.customer) &&
      (filter.lob === null || row.group_1_gl === filter.lob),
  )

/** Choices for the filter controls, taken from the rows the caller can actually see. */
export interface RevenueOptions {
  tahun: number[]
  cab: string[]
  customer: string[]
  lob: string[]
}

export const optionsFrom = (rows: RevenueRow[]): RevenueOptions => ({
  tahun: [...new Set(rows.map((row) => row.tahun))].sort((a, b) => b - a),
  cab: [...new Set(rows.map((row) => row.cab))].sort(),
  customer: [...new Set(rows.map((row) => row.customer))].sort(),
  lob: [...new Set(rows.map((row) => row.group_1_gl).filter((v): v is string => v !== null))].sort(),
})

/** The dimensions a ranking table can be cut by, named once so tabs cannot disagree. */
export const DIMENSI = {
  lob: (row: RevenueRow) => row.group_1_gl,
  group2: (row: RevenueRow) => row.group_2_gl,
  group3: (row: RevenueRow) => row.group_3_gl,
  textPl: (row: RevenueRow) => row.text_pl,
  cabang: (row: RevenueRow) => row.cab,
  customer: (row: RevenueRow) => row.customer,
} as const

/** A `DIMENSI` key, so a client component can request a dimension by name across a server/client prop boundary instead of passing the accessor function itself. */
export type DimensiKey = keyof typeof DIMENSI

// ── Measures ────────────────────────────────────────────────────────────────────

/**
 * `perUnit` divides money by units, which is the only reading of "(UP)" — unit
 * produksi — that yields a defined figure. It is a ratio, so it can never be summed:
 * every aggregate takes the quotient of the two totals rather than the mean of the
 * quotients, which is the difference between a weighted average and a wrong one.
 */
const aggregate = (rows: RevenueRow[], measure: Measure): number => {
  const total = rows.reduce((sum, row) => sum + Number(row.total), 0)
  const production = rows.reduce((sum, row) => sum + Number(row.production), 0)
  if (measure === 'rupiah') return total
  if (measure === 'unit') return production
  return production === 0 ? 0 : total / production
}

// ── Derived figures ─────────────────────────────────────────────────────────────

export interface RevenueKpi {
  rkap: number
  aktual: number
  /** Last year's actual, carried rather than back-derived from %YoY. */
  sebelumnya: number
  /** Aktual − RKAP. Negative is a shortfall, and is the usual case. */
  diff: number
  /** Aktual ÷ RKAP, or null when there is no budget to measure against. */
  ach: number | null
  /** Growth against the prior year's actual, or null when there is no prior year. */
  yoy: number | null
}

/**
 * The KPI row for one year and one measure.
 *
 * Derived on every read rather than stored, for the same reason GPM is: a card and a
 * report that computed the same number separately will eventually disagree, and the
 * one nobody re-checks is the one that is wrong.
 *
 * `%Ach` and `%YoY` are null rather than zero when their denominator is missing. Zero
 * would render as "0%", which reads as a real and very bad result.
 */
export const kpiFor = (rows: RevenueRow[], tahun: number, measure: Measure): RevenueKpi => {
  const slice = (year: number, plan: string): RevenueRow[] =>
    rows.filter((row) => row.tahun === year && row.plan_actual === plan)

  const rkap = aggregate(slice(tahun, 'Plan'), measure)
  const aktual = aggregate(slice(tahun, 'Actual'), measure)
  const sebelumnya = aggregate(slice(tahun - 1, 'Actual'), measure)

  return {
    rkap,
    aktual,
    sebelumnya,
    diff: aktual - rkap,
    ach: rkap === 0 ? null : aktual / rkap,
    yoy: sebelumnya === 0 ? null : (aktual - sebelumnya) / sebelumnya,
  }
}

export interface Bulanan {
  bulan: number
  label: string
  rkap: number
  aktual: number
  tahunLalu: number
}

export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** Twelve rows whatever the data holds, so a missing month is a gap and not a shift. */
export const bulananFor = (rows: RevenueRow[], tahun: number, measure: Measure): Bulanan[] =>
  BULAN.map((label, index) => {
    // `periode` is a date column; PostgREST hands it back as `YYYY-MM-DD`, so the month
    // is read off the string rather than through a Date, which would apply a timezone
    // to a value that has none.
    const inMonth = (row: RevenueRow, year: number, plan: string): boolean =>
      row.tahun === year &&
      row.plan_actual === plan &&
      Number(row.periode.slice(5, 7)) === index + 1

    return {
      bulan: index + 1,
      label,
      rkap: aggregate(rows.filter((row) => inMonth(row, tahun, 'Plan')), measure),
      aktual: aggregate(rows.filter((row) => inMonth(row, tahun, 'Actual')), measure),
      tahunLalu: aggregate(rows.filter((row) => inMonth(row, tahun - 1, 'Actual')), measure),
    }
  })

export interface Peringkat extends RevenueKpi {
  nama: string
}

/** Ranks by actual, descending — a league table reads from the top down. */
export const peringkatBy = (
  rows: RevenueRow[],
  tahun: number,
  measure: Measure,
  key: (row: RevenueRow) => string | null,
): Peringkat[] => {
  const label = (row: RevenueRow): string => key(row) ?? '(tanpa keterangan)'
  const names = [...new Set(rows.map(label))]

  return names
    .map((nama) => ({ nama, ...kpiFor(rows.filter((row) => label(row) === nama), tahun, measure) }))
    .filter((entry) => entry.rkap !== 0 || entry.aktual !== 0)
    .sort((a, b) => b.aktual - a.aktual)
}

/** The most recent year the data actually covers, so the page is never empty by default. */
export const tahunTerbaru = (rows: RevenueRow[]): number =>
  rows.reduce((latest, row) => (row.tahun > latest ? row.tahun : latest), 0) ||
  new Date().getUTCFullYear()

// ── Cumulative pace ─────────────────────────────────────────────────────────────

export interface Kumulatif {
  label: string
  rkap: number
  aktual: number
  tahunLalu: number
}

/**
 * Running totals through the year.
 *
 * The monthly bars answer "how did June go"; this answers "are we catching up or
 * falling further behind", which is the question a mid-year budget conversation
 * actually turns on. The two charts are not the same picture at different scales —
 * a run of merely-below-target months looks unremarkable month by month and looks
 * like a widening canyon here.
 *
 * A month with no actual yet contributes nothing rather than flattening the line at
 * its last value, so the gap does not appear to stop growing in September.
 */
export const kumulatifFor = (rows: Bulanan[]): Kumulatif[] => {
  let rkap = 0
  let aktual = 0
  let tahunLalu = 0
  const out: Kumulatif[] = []

  for (const bulan of rows) {
    rkap += bulan.rkap
    aktual += bulan.aktual
    tahunLalu += bulan.tahunLalu
    out.push({
      label: bulan.label,
      rkap,
      // Once the actuals run out, the cumulative line stops rather than running on
      // flat — a flat line reads as "no growth", not as "no data yet".
      aktual: bulan.aktual === 0 && aktual > 0 && rows.indexOf(bulan) > 0 ? Number.NaN : aktual,
      tahunLalu,
    })
  }
  return out
}

// ── Composition ─────────────────────────────────────────────────────────────────

export interface Bagian {
  nama: string
  nilai: number
  porsi: number
}

/** Share of the year's actual, largest first — what the book is actually made of. */
export const komposisi = (
  rows: RevenueRow[],
  tahun: number,
  measure: Measure,
  key: (row: RevenueRow) => string | null,
): Bagian[] => {
  const peringkat = peringkatBy(rows, tahun, measure, key)
  const total = peringkat.reduce((sum, row) => sum + row.aktual, 0)
  return peringkat.map((row) => ({
    nama: row.nama,
    nilai: row.aktual,
    porsi: total === 0 ? 0 : row.aktual / total,
  }))
}

/**
 * Rupiah earned per unit produced, per dimension.
 *
 * A ratio of two sums, never a mean of ratios: a station handling ten thousand cheap
 * units and one handling ten expensive ones must not average out as though they were
 * comparable. This is the figure the Production tab exists to expose — volume alone
 * says nothing about whether the volume was worth having.
 */
export interface Yield {
  nama: string
  produksi: number
  pendapatan: number
  perUnit: number
}

export const yieldBy = (
  rows: RevenueRow[],
  tahun: number,
  key: (row: RevenueRow) => string | null,
): Yield[] => {
  const label = (row: RevenueRow): string => key(row) ?? '(tanpa keterangan)'
  const aktual = rows.filter((row) => row.tahun === tahun && row.plan_actual === 'Actual')
  const names = [...new Set(aktual.map(label))]

  return names
    .map((nama) => {
      const mine = aktual.filter((row) => label(row) === nama)
      const produksi = mine.reduce((sum, row) => sum + Number(row.production), 0)
      const pendapatan = mine.reduce((sum, row) => sum + Number(row.total), 0)
      return { nama, produksi, pendapatan, perUnit: produksi === 0 ? 0 : pendapatan / produksi }
    })
    .sort((a, b) => b.perUnit - a.perUnit)
}

// ── B2B / B2C ───────────────────────────────────────────────────────────────────

/**
 * The two halves of the book, taken from the customer's own attribute.
 *
 * This used to guess: CORE BUSINESS meant B2B, OTHER BUSINESS meant B2C — a proxy that
 * read "Citilink" as a person and put an airline on the consumer side. `CRM_Data` now
 * carries `Customer Type`, the pull stores it on `customers.tipe`, so the guess is gone
 * (D-4). The revenue row holds only the customer's name, so the caller hands in a
 * name→tipe map built off `customers`.
 *
 * A customer whose tipe the Sheet has not answered appears on neither side. Null means
 * unknown, not agent.
 */
export type Segmen = 'B2B' | 'B2C'

export const inSegmen = (
  rows: RevenueRow[],
  segmen: Segmen,
  tipeByNama: Map<string, 'agent' | 'non_agent' | null>,
): RevenueRow[] => {
  const wanted = segmen === 'B2B' ? 'agent' : 'non_agent'
  return rows.filter((row) => tipeByNama.get(row.customer) === wanted)
}

// ── Daily ───────────────────────────────────────────────────────────────────────

export interface Harian {
  hari: number
  aktual: number
  tahunLalu: number
}

/**
 * Day of the month, summed across every month of the year.
 *
 * This is the shape the client's tracker draws, and it answers a different question
 * from the monthly bars: whether the month has a rhythm. Departures cluster at
 * month-end, cargo clears mid-month, premium service peaks around holidays — a pattern
 * that is invisible once each month is collapsed to a single column.
 *
 * Thirty-one slots regardless. Day 31 sums fewer months than day 15 and will sit low
 * for that reason alone; the caption says so rather than the series quietly hiding it.
 */
export const harianFor = (rows: RevenueRow[], tahun: number, measure: Measure): Harian[] => {
  const slots: Harian[] = Array.from({ length: 31 }, (_, i) => ({
    hari: i + 1,
    aktual: 0,
    tahunLalu: 0,
  }))

  for (const row of rows) {
    if (row.plan_actual !== 'Actual') continue
    // Read off the string: `periode` is a date column with no timezone, and putting it
    // through a Date would shift a 1 January row into the previous year.
    const hari = Number(row.periode.slice(8, 10))
    const slot = slots[hari - 1]
    if (!slot) continue

    const nilai =
      measure === 'unit'
        ? Number(row.production)
        : measure === 'perUnit'
          ? 0
          : Number(row.total)

    if (row.tahun === tahun) slot.aktual += nilai
    if (row.tahun === tahun - 1) slot.tahunLalu += nilai
  }
  return slots
}

/** Whether the source carries more than one day per month at all. */
export const punyaHarian = (rows: RevenueRow[]): boolean =>
  new Set(rows.map((row) => row.periode.slice(8, 10))).size > 1

// ── Tone ────────────────────────────────────────────────────────────────────────

/**
 * Achievement against budget, banded.
 *
 * Lives here rather than in the (client) tables module because a server component
 * (`OverviewPanel`'s `StatCard`s) calls it directly — a plain function export from a
 * `'use client'` file can only be handed to JSX, never invoked from server code.
 *
 * The cut-offs are provisional — C-05. The Power BI screenshots colour 96,51% green,
 * 58,07% amber and 20,51% red, and no document states where the boundaries sit.
 */
export const toneFor = (value: number | null): 'neutral' | 'good' | 'warn' | 'bad' =>
  value === null ? 'neutral' : value >= 0.95 ? 'good' : value >= 0.6 ? 'warn' : 'bad'
