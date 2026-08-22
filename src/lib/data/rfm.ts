import type { RevenueRow } from '@/lib/data/revenue'
import type { RfmStatus } from '@/lib/domain'

/**
 * Customer standing — the RFM board behind the LoB tab.
 *
 * Two things are being said about each customer at once, and the client's own tracker
 * keeps them in separate columns because they answer different questions:
 *
 *   - **Classification** is worth: HIGH, MIDDLE, LOW. It comes from `CRM_Data` and is
 *     maintained by the business.
 *   - **Status** is life: Active, Risk, Dormant, Lost. It is derived here from how long
 *     ago they last transacted, because nothing stores it.
 *
 * A HIGH customer who has gone quiet is the single most valuable row on the page, and
 * neither column alone would surface them.
 */

// ── Agent / Non-Agent ───────────────────────────────────────────────────────────

export type CustomerType = 'agent' | 'non_agent'

/**
 * Organisation or person, read from the Sheet — never inferred.
 *
 * The client's tracker splits RFM into B2B (agents, hotels, corporates — the "Agent
 * Detail" table) and B2C (individual people). `CRM_Data` now carries a `Customer Type`
 * column and the daily pull lands it in `customers.tipe`.
 *
 * A name-based guess was tried first and thrown away: it read "Batik Air" as an
 * organisation and "Citilink" as a person, because one happens to contain an industry
 * word. An airline listed under *pelanggan perorangan* is a mistake that looks entirely
 * plausible, which is the worst kind to ship.
 *
 * Null stays null. A customer the Sheet has not classified appears on neither board and
 * is counted separately, rather than being defaulted onto one of them.
 */

export const SEGMEN_TIPE: Record<'B2B' | 'B2C', CustomerType> = {
  B2B: 'agent',
  B2C: 'non_agent',
}

// ── Lifecycle status ────────────────────────────────────────────────────────────

export const STATUSES = ['Active', 'Risk', 'Dormant', 'Lost'] as const
export type Standing = (typeof STATUSES)[number]

/**
 * How long a silence has to run before it means something.
 *
 * The client's tracker shows a "Last Transaction (Day)" column beside a status of
 * Active, Dormant, Lost or Risk, and states no thresholds anywhere. These are a
 * reading, not a rule — recorded as C-18 — and they are expressed in days so they can
 * be replaced without touching anything else.
 *
 * The Sheet stores one row per month, so the finest resolution available is the month
 * a customer last transacted in. A "Last Transaction (Day)" of 79 in their dashboard
 * becomes "about 79 days" here, counted from the first of that month.
 */
export const AMBANG_STATUS = { active: 45, risk: 90, dormant: 180 } as const

export const statusFor = (hari: number | null): Standing => {
  if (hari === null) return 'Lost'
  if (hari <= AMBANG_STATUS.active) return 'Active'
  if (hari <= AMBANG_STATUS.risk) return 'Risk'
  if (hari <= AMBANG_STATUS.dormant) return 'Dormant'
  return 'Lost'
}

export const STATUS_TONE: Record<Standing, 'good' | 'warn' | 'bad' | 'neutral'> = {
  Active: 'good',
  Risk: 'warn',
  Dormant: 'warn',
  Lost: 'bad',
}

// ── The board ───────────────────────────────────────────────────────────────────

export interface CustomerRfm {
  customerId: string
  nama: string
  rfmStatus: RfmStatus
  frequency: number | null
  monetary: number | null
  recency: number | null
  tipe: CustomerType | null
}

export interface CustomerStanding {
  nama: string
  tipe: CustomerType | null
  klasifikasi: RfmStatus
  status: Standing
  frequency: number | null
  monetary: number | null
  recency: number | null
  produksi: number
  pendapatan: number
  /** Days since the last month this customer transacted in, or null if never. */
  hariSejakTransaksi: number | null
  transaksiTerakhir: string | null
}

const MS_PER_DAY = 86_400_000

/**
 * One row per customer that actually transacted in the chosen year.
 *
 * A customer with no revenue in scope is left out rather than listed at zero. Padding
 * the board with zeroes would drag every average down and make a segment look busier
 * than it is — and "no rows" is the honest answer when a filter excludes everyone.
 */
export const standingFor = (
  rows: RevenueRow[],
  customers: CustomerRfm[],
  tahun: number,
  hariIni: Date,
): CustomerStanding[] => {
  const aktual = rows.filter((row) => row.tahun === tahun && row.plan_actual === 'Actual')
  const known = new Map(customers.map((c) => [c.nama, c]))
  const names = [...new Set(aktual.map((row) => row.customer))]

  return names
    .map((nama) => {
      const mine = aktual.filter((row) => row.customer === nama)
      const pendapatan = mine.reduce((sum, row) => sum + Number(row.total), 0)
      const produksi = mine.reduce((sum, row) => sum + Number(row.production), 0)

      // The latest month carrying a non-zero figure. A month present in the Sheet at
      // zero is not a transaction, and counting it would report a dormant customer as
      // active on the strength of a placeholder row.
      const terakhir = mine
        .filter((row) => Number(row.total) > 0 || Number(row.production) > 0)
        .map((row) => row.periode)
        .sort()
        .at(-1)

      const hari =
        terakhir === undefined
          ? null
          : Math.max(
              0,
              Math.round((hariIni.getTime() - Date.parse(`${terakhir}T00:00:00Z`)) / MS_PER_DAY),
            )

      const crm = known.get(nama)
      return {
        nama,
        tipe: crm?.tipe ?? null,
        klasifikasi: crm?.rfmStatus ?? 'LOW',
        status: statusFor(hari),
        frequency: crm?.frequency ?? null,
        monetary: crm?.monetary ?? null,
        recency: crm?.recency ?? null,
        produksi,
        pendapatan,
        hariSejakTransaksi: hari,
        transaksiTerakhir: terakhir ?? null,
      }
    })
    .sort((a, b) => b.pendapatan - a.pendapatan)
}

export interface Hitungan<T extends string> {
  kunci: T
  jumlah: number
  pendapatan: number
  porsi: number
}

/** Counts and revenue share for one categorical column of the board. */
export const tally = <T extends string>(
  board: CustomerStanding[],
  urutan: readonly T[],
  key: (row: CustomerStanding) => T,
): Hitungan<T>[] => {
  const total = board.reduce((sum, row) => sum + row.pendapatan, 0)
  return urutan.map((kunci) => {
    const anggota = board.filter((row) => key(row) === kunci)
    const pendapatan = anggota.reduce((sum, row) => sum + row.pendapatan, 0)
    return { kunci, jumlah: anggota.length, pendapatan, porsi: total === 0 ? 0 : pendapatan / total }
  })
}
