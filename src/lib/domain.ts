/**
 * The derived vocabulary of G-CME.
 *
 * None of this is stored. GPM, days remaining, the status band and margin health are
 * computed from the contract row every time they are shown, so a badge and an email
 * can never disagree about the same contract.
 */

export const BUSINESS_LINES = [
  'Ground Handling',
  'Cargo & Warehouse',
  'Ancillary Business',
] as const
export type BusinessLine = (typeof BUSINESS_LINES)[number]

export const RFM_STATUSES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type RfmStatus = (typeof RFM_STATUSES)[number]

export type CaseStatus = 'OPEN' | 'CLOSED'
export type UserRole = 'vp' | 'commercial'
export type ScenarioStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export const STATUS_BANDS = ['Aman', 'Perlu Perhatian', 'Kritis', 'Nonaktif'] as const
export type StatusBand = (typeof STATUS_BANDS)[number]

/**
 * Days before expiry at which a reminder fires. The status bands below are aligned to
 * these, so a contract cannot be badged "Aman" on a day it also triggers a reminder.
 */
export const REMINDER_MILESTONES = [60, 30, 14] as const
export type ReminderMilestone = (typeof REMINDER_MILESTONES)[number]

/** Gross profit margin as a fraction. Returns 0 for a non-positive tarif. */
export const gpm = (tarif: number, cost: number): number =>
  tarif > 0 ? (tarif - cost) / tarif : 0

export const grossProfit = (tarif: number, cost: number): number => tarif - cost

/**
 * Whether a margin clears its target.
 *
 * The epsilon matters: `(11000 - 7800) / 11000` is not exactly representable, so a
 * contract sitting precisely on its target would otherwise be reported as breaching
 * it. Every comparison of a margin against a target goes through here rather than
 * writing `>=` locally, so they cannot disagree at the boundary.
 */
export const meetsTarget = (actualGpm: number, target: number): boolean =>
  actualGpm - target > -1e-9

/**
 * The lowest tarif that still meets `target` at the given cost — the negotiating
 * floor. Derived from (t - c) / t >= target, so t >= c / (1 - target).
 */
export const minimumTarifForTarget = (cost: number, target: number): number =>
  target >= 1 ? Number.POSITIVE_INFINITY : cost / (1 - target)

/**
 * Whole days from `from` to `to`, both ISO `YYYY-MM-DD`. Negative once the end date
 * has passed. Parsed as UTC midnight on both sides so the result never shifts with
 * the runtime's timezone.
 */
export const daysBetween = (from: string, to: string): number => {
  const parse = (iso: string): number => {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
    return Date.UTC(year!, month! - 1, day!)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/**
 * Today in Asia/Jakarta as an ISO date. The contracts carry dates, not timestamps,
 * so "how many days left" has to be answered in the business's own timezone rather
 * than the server's.
 */
export const todayInJakarta = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

export const daysRemaining = (contractEndDate: string, today = todayInJakarta()): number =>
  daysBetween(today, contractEndDate)

/**
 * The status band, aligned to the reminder milestones:
 *
 *   past end date → Nonaktif
 *   0–14          → Kritis
 *   15–60         → Perlu Perhatian
 *   over 60       → Aman
 */
export const statusBand = (daysLeft: number): StatusBand => {
  if (daysLeft < 0) return 'Nonaktif'
  if (daysLeft <= 14) return 'Kritis'
  if (daysLeft <= 60) return 'Perlu Perhatian'
  return 'Aman'
}

export interface MarginHealth {
  /** Actual GPM as a fraction. */
  gpm: number
  /** The contract's own Min_GPM_Target as a fraction. */
  target: number
  /** gpm - target. Negative means the contract is below its own target. */
  delta: number
  meetsTarget: boolean
}

export const marginHealth = (tarif: number, cost: number, target: number): MarginHealth => {
  const actual = gpm(tarif, cost)
  return {
    gpm: actual,
    target,
    delta: actual - target,
    meetsTarget: meetsTarget(actual, target),
  }
}

// ─── Formatting ──────────────────────────────────────────────────────────────

/**
 * Full Rupiah, Indonesian convention: `Rp 12.500.000`, `Rp 4.200`.
 *
 * Tarif spans three orders of magnitude in this data — Rp 4.200 per kg through
 * Rp 120.000.000 flat — so the full form never abbreviates. It is the safe default
 * anywhere the exact figure matters.
 */
export const formatRupiah = (value: number): string =>
  `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))}`

/**
 * Rupiah shortened for dense table cells, abbreviating only where doing so keeps the
 * figure legible. Values under a million are shown in full, so a Rp 4.200 per-kg
 * cargo tarif reads as itself rather than collapsing to "Rp 0,0 jt".
 */
export const formatRupiahCompact = (value: number): string => {
  const abs = Math.abs(value)
  if (abs < 1_000_000) return formatRupiah(value)

  const format = (v: number, unit: string): string => {
    // One decimal below 100 units, none above, so the string stays about as wide.
    const digits = Math.abs(v) < 100 ? 1 : 0
    const rendered = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(v)
    return `Rp ${rendered} ${unit}`
  }

  if (abs >= 1_000_000_000_000) return format(value / 1_000_000_000_000, 'T')
  if (abs >= 1_000_000_000) return format(value / 1_000_000_000, 'M')
  return format(value / 1_000_000, 'jt')
}

/** A fraction as an Indonesian percentage: 0.2909 → "29,1%". */
export const formatPercent = (fraction: number, digits = 1): string =>
  `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fraction * 100)}%`

/** A signed fraction as percentage points: -0.009 → "-0,9 pp". */
export const formatPercentagePoints = (fraction: number, digits = 1): string => {
  const points = fraction * 100
  const sign = points > 0 ? '+' : ''
  return `${sign}${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(points)} pp`
}

const LONG_DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** ISO date to Indonesian long form: `2026-09-15` → "15 September 2026". */
export const formatTanggal = (iso: string): string =>
  LONG_DATE.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))

/** How the remaining time reads on a badge. */
export const formatSisaHari = (daysLeft: number): string => {
  if (daysLeft < 0) return `Lewat ${Math.abs(daysLeft)} hari`
  if (daysLeft === 0) return 'Berakhir hari ini'
  return `${daysLeft} hari lagi`
}

// ─── Volume and revenue ──────────────────────────────────────────────────────

/**
 * What a tarif is charged per, by line. The workbook prices Ground Handling per
 * handling, Cargo per kg and Ancillary as a flat fee, so the unit follows the business
 * line rather than needing a column of its own.
 */
export const VOLUME_UNITS: Record<BusinessLine, string> = {
  'Ground Handling': 'penanganan',
  'Cargo & Warehouse': 'kg',
  'Ancillary Business': 'layanan',
}

/**
 * Revenue for the contract's term, or null when no volume has been recorded.
 *
 * Null rather than zero, deliberately: "nobody has entered a volume" and "this
 * contract earns nothing" are different facts, and totalling them together would
 * understate the book while looking authoritative.
 */
export const revenue = (tarif: number, volume: number | null): number | null =>
  volume === null ? null : tarif * volume

/** Gross profit in Rupiah for the term, on the same null-means-unknown rule. */
export const grossProfitTotal = (
  tarif: number,
  cost: number,
  volume: number | null,
): number | null => (volume === null ? null : (tarif - cost) * volume)

/** Volume in Indonesian convention, with the unit its line is priced in. */
export const formatVolume = (volume: number, businessLine: BusinessLine): string =>
  `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(volume)} ${VOLUME_UNITS[businessLine]}`
