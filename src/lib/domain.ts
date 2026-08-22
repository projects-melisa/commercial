/**
 * The derived vocabulary of Gapura Commercial.
 *
 * None of this is stored. GPM, days remaining, the status band and margin health are
 * computed from the contract row every time they are shown, so a badge and an email
 * can never disagree about the same contract.
 */

// Named as the Google Sheet names them; the Sheet is the source of truth and calls
// the middle one "Cargo Handling", not the workbook's "Cargo & Warehouse".
export const BUSINESS_LINES = [
  'Ground Handling',
  'Cargo Handling',
  'Ancillary Business',
] as const
export type BusinessLine = (typeof BUSINESS_LINES)[number]

export const RFM_STATUSES = ['HIGH', 'MEDIUM', 'LOW'] as const
export type RfmStatus = (typeof RFM_STATUSES)[number]

/**
 * The RFM bands in words, so a table cell reads as a judgement rather than a shout.
 *
 * "HIGH" alone says nothing about which direction is good; the phrase does.
 */
export const RFM_LABELS: Record<RfmStatus, string> = {
  HIGH: 'HIGH — bernilai tinggi',
  MEDIUM: 'MEDIUM — perlu dijaga',
  LOW: 'LOW — berisiko lepas',
}

export type CaseStatus = 'OPEN' | 'CLOSED'
/**
 * The nine roles, named as the client's access matrix names them.
 *
 * Eight come from that matrix; `super_admin` is the ninth, added because the matrix
 * has no one who can create a user. It manages who holds which role and reads no
 * business data at all, which keeps the most widely shared account the least able
 * to see anything.
 *
 * What each role may touch is not decided here. It lives in `role_module_grants` in
 * the database and is read through `caller_may(module, action)`, so this union names
 * the roles without also claiming to know their powers.
 */
export const USER_ROLES = [
  'commercial_kps',
  'vp',
  'direktur_utama',
  'cabang',
  'finance_kps',
  'op_kps',
  'os_kps',
  'ocs_kps',
  'super_admin',
] as const
export type UserRole = (typeof USER_ROLES)[number]

/** How each role is named on screen. */
export const ROLE_LABELS: Record<UserRole, string> = {
  commercial_kps: 'Commercial KPS',
  vp: 'VP',
  direktur_utama: 'Direktur Utama',
  cabang: 'GM Cabang',
  finance_kps: 'Finance KPS',
  op_kps: 'OP KPS',
  os_kps: 'OS KPS',
  ocs_kps: 'OCS KPS',
  super_admin: 'Super Admin',
}

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
  /** The contract's own Min_GPM_Target as a fraction, or null when none is recorded. */
  target: number | null
  /** gpm - target, or null when there is no target to measure against. */
  delta: number | null
  /**
   * Whether the margin clears its target — and null when there is no target.
   *
   * Three states, not two, and deliberately so: a contract nobody has set a target
   * for has not passed and has not failed. Collapsing null to `false` would report a
   * breach that was never defined, and to `true` would report health nobody verified.
   * Every caller therefore has to say which of the two it means.
   */
  meetsTarget: boolean | null
}

export const marginHealth = (
  tarif: number,
  cost: number,
  target: number | null,
): MarginHealth => {
  const actual = gpm(tarif, cost)
  if (target === null) return { gpm: actual, target: null, delta: null, meetsTarget: null }
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

/**
 * A margin target for display, said plainly when there is none.
 *
 * The Sheet carries no `Min_GPM_Target` column, so most contracts now have no target
 * at all. Rendering that as "0%" would claim every contract clears a zero floor; this
 * says what is actually true.
 */
export const NO_TARGET_LABEL = 'belum ditetapkan'
export const formatTarget = (target: number | null, digits = 1): string =>
  target === null ? NO_TARGET_LABEL : formatPercent(target, digits)

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
 * What a tarif is charged per, by line. Ground Handling is priced per handling, Cargo
 * per kg and Ancillary as a flat fee, so the unit follows the business line rather
 * than needing a column of its own.
 */
export const VOLUME_UNITS: Record<BusinessLine, string> = {
  'Ground Handling': 'penanganan',
  'Cargo Handling': 'kg',
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

/**
 * What a revenue tab is counting.
 *
 * Lives here rather than beside the query because the charts are client components and
 * the query module reaches for the server Supabase client. A formatter passed as a prop
 * would have been the obvious shortcut, and React refuses it outright — functions do not
 * cross the server/client boundary. Naming the measure and formatting on both sides from
 * one function is what keeps an axis tick and a table cell rendering the same figure.
 */
export type Measure = 'rupiah' | 'unit' | 'perUnit'

export const formatMeasure = (measure: Measure, value: number): string => {
  // Units are counts, so no currency and no abbreviation — "1.240" not "Rp 1,2 rb".
  if (measure === 'unit') {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(value))
  }
  // A per-unit figure is small enough to state in full, and abbreviating it would
  // collapse a Rp 4.200 rate to "Rp 0,0 jt".
  if (measure === 'perUnit') return formatRupiah(value)
  return formatRupiahCompact(value)
}
