import { createClient } from '@/lib/supabase/server'
import type { DetailRef } from '@/lib/data/detail'
import type { Database } from '@/lib/supabase/database.types'

import { AGING_BUCKETS, TAHAP_LABELS, TAHAP_ORDER, type AgingKey } from '@/lib/data/domains-constants'

export { AGING_BUCKETS, TAHAP_LABELS, TAHAP_ORDER, type AgingKey }

/**
 * Receivables, penalties, irregularities and the Power BI links.
 *
 * Every query here is unscoped on purpose. `receivables` and `penalties` have no
 * station column at all — that is exactly why a GM Cabang gets nothing from them
 * rather than a plausible-looking subset — and `cases` is OCS-only. The policies
 * decide; a `.eq()` written here would hide a policy mistake instead of preventing
 * one, and would keep working on the day the policy stopped.
 */

// ── Piutang ─────────────────────────────────────────────────────────────────────

export interface Receivable {
  customerId: string
  customerNama: string
  status: string
  buckets: Record<AgingKey, number>
  /** The Sheet's own total, not our sum — see below. */
  total: number
  /** What the buckets actually add up to, so a disagreement is visible. */
  jumlahBucket: number
}

export const listReceivables = async (): Promise<Receivable[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('receivables')
    .select('*, customers(nama)')
    .order('total', { ascending: false })
  if (error) throw new Error(`Gagal memuat piutang: ${error.message}`)

  return (data ?? []).map((row) => {
    const buckets = Object.fromEntries(
      AGING_BUCKETS.map(([key]) => [key, Number(row[key])]),
    ) as Record<AgingKey, number>

    return {
      customerId: row.customer_id,
      customerNama: (row.customers as { nama: string } | null)?.nama ?? row.customer_id,
      status: row.status,
      buckets,
      // Finance maintains the total by hand alongside the buckets. Substituting our
      // own sum would quietly paper over the day the two disagree, which is a fact
      // about the source worth seeing rather than a rounding error to smooth away.
      total: Number(row.total),
      jumlahBucket: Object.values(buckets).reduce((sum, value) => sum + value, 0),
    }
  })
}

/** Accumulated receivable — the figure the requirement actually asks for. */
export const totalReceivable = (rows: Receivable[]): number =>
  rows.reduce((sum, row) => sum + row.total, 0)

export interface AgingRow {
  /** OPEN, CLOSED, or whatever else Finance has written in the Sheet's Status column. */
  status: string
  buckets: Record<AgingKey, number>
  total: number
}

/**
 * The aging book folded into one row per status, plus the column totals.
 *
 * The status values are read off the data rather than enumerated here: the Sheet's
 * Status column is free text maintained by Finance, and a hard-coded pair would
 * silently drop a third value the day somebody introduced one. OPEN leads because it
 * is the half anyone acts on.
 *
 * Each row's `total` sums that row's buckets. It deliberately does *not* reuse the
 * Sheet's own Total column, which is maintained by hand and may disagree — the
 * per-customer table on /piutang is where that disagreement is surfaced, and a matrix
 * whose rows did not add up to its columns would be unreadable.
 */
export const agingMatrix = (rows: Receivable[]): { rows: AgingRow[]; total: AgingRow } => {
  const empty = (): Record<AgingKey, number> =>
    Object.fromEntries(AGING_BUCKETS.map(([key]) => [key, 0])) as Record<AgingKey, number>

  const byStatus = new Map<string, Record<AgingKey, number>>()
  const grand = empty()

  for (const row of rows) {
    const buckets = byStatus.get(row.status) ?? empty()
    for (const [key] of AGING_BUCKETS) {
      buckets[key] += row.buckets[key]
      grand[key] += row.buckets[key]
    }
    byStatus.set(row.status, buckets)
  }

  const sum = (buckets: Record<AgingKey, number>): number =>
    AGING_BUCKETS.reduce((running, [key]) => running + buckets[key], 0)

  const ordered = [...byStatus.entries()].sort(([a], [b]) => {
    if (a === b) return 0
    if (a === 'OPEN') return -1
    if (b === 'OPEN') return 1
    return a.localeCompare(b)
  })

  return {
    rows: ordered.map(([status, buckets]) => ({ status, buckets, total: sum(buckets) })),
    total: { status: 'Total', buckets: grand, total: sum(grand) },
  }
}

/** Receivables split by status, for the dashboard donut. */
export const receivableStatusSplit = (
  rows: Receivable[],
): { name: string; value: number; items: DetailRef[] }[] => {
  const byStatus = new Map<string, Receivable[]>()
  for (const row of rows) {
    const existing = byStatus.get(row.status)
    if (existing) existing.push(row)
    else byStatus.set(row.status, [row])
  }
  return [...byStatus.entries()]
    .map(([name, matching]) => ({
      name,
      value: matching.length,
      items: matching.map((r) => ({ kind: 'receivable' as const, id: r.customerId, label: r.customerNama })),
    }))
    .sort((a, b) => (a.name === 'OPEN' ? -1 : b.name === 'OPEN' ? 1 : a.name.localeCompare(b.name)))
}

// ── Penalty ─────────────────────────────────────────────────────────────────────

export interface Penalty {
  id: string
  customerId: string
  customerNama: string
  deskripsi: string
  nilai: number | null
  cabangAsal: string | null
  tahap: string
  dilaporkanPada: string | null
  /** Application state beside the Sheet's stage: when this station validated. */
  divalidasiPada: string | null
}

export const listPenalties = async (): Promise<Penalty[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('penalties')
    .select('*, customers(nama)')
    .order('dilaporkan_pada', { ascending: false, nullsFirst: false })
  if (error) throw new Error(`Gagal memuat penalty: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerNama: (row.customers as { nama: string } | null)?.nama ?? row.customer_id,
    deskripsi: row.deskripsi,
    nilai: row.nilai === null ? null : Number(row.nilai),
    cabangAsal: row.cabang_asal,
    tahap: row.tahap,
    dilaporkanPada: row.dilaporkan_pada,
    divalidasiPada: row.validated_at,
  }))
}

// ── Irregularities ──────────────────────────────────────────────────────────────

export interface Irregularity {
  id: string
  customerId: string
  customerNama: string
  description: string
  status: 'OPEN' | 'CLOSED'
}

export const listIrregularities = async (): Promise<Irregularity[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cases')
    .select('id, customer_id, description, status, customers(nama)')
    .order('status')
  if (error) throw new Error(`Gagal memuat irregularities: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerNama: (row.customers as { nama: string } | null)?.nama ?? row.customer_id,
    description: row.description,
    status: row.status,
  }))
}

// ── Power BI links ──────────────────────────────────────────────────────────────

type AppModule = Database['public']['Enums']['app_module']

export interface ReportLink {
  modul: AppModule
  judul: string
  url: string
}

/**
 * The outbound Power BI link for one module, or null when none is configured.
 *
 * Null rather than a disabled button: a control that cannot be pressed still says a
 * report exists somewhere, and nobody can act on that.
 */
export const reportLinkFor = async (modul: AppModule): Promise<ReportLink | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('report_links')
    .select('modul, judul, url')
    .eq('modul', modul)
    .eq('aktif', true)
    .maybeSingle()
  return data ?? null
}

export const listReportLinks = async (): Promise<(ReportLink & { aktif: boolean })[]> => {
  const supabase = await createClient()
  const { data } = await supabase.from('report_links').select('modul, judul, url, aktif').order('modul')
  return data ?? []
}

// ── Per-customer summaries, for the contract page ───────────────────────────────

export interface CustomerRisk {
  piutangTotal: number
  piutangStatus: string | null
  penaltyCount: number
  penaltyNilai: number
  penaltyTerbuka: number
}

/**
 * The receivable and penalty standing of one customer.
 *
 * Rendered on the contract page because that is where the renewal decision is taken —
 * COMMERSIL.docx asks for exactly this, and a figure kept one page away from the
 * decision is a figure nobody checks.
 *
 * A caller without the grant gets zeroes from RLS rather than an error, so the page
 * asks whether they hold it before rendering the block at all. Otherwise "no debt"
 * and "not allowed to know" would look identical.
 */
export const riskFor = async (customerId: string): Promise<CustomerRisk> => {
  const supabase = await createClient()
  const [receivable, penalties] = await Promise.all([
    supabase.from('receivables').select('total, status').eq('customer_id', customerId).maybeSingle(),
    supabase.from('penalties').select('nilai, tahap').eq('customer_id', customerId),
  ])

  const rows = penalties.data ?? []
  return {
    piutangTotal: Number(receivable.data?.total ?? 0),
    piutangStatus: receivable.data?.status ?? null,
    penaltyCount: rows.length,
    penaltyNilai: rows.reduce((sum, row) => sum + Number(row.nilai ?? 0), 0),
    penaltyTerbuka: rows.filter((row) => row.tahap !== 'ditutup').length,
  }
}
