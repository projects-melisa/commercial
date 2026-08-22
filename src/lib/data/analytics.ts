import type { DetailRef } from '@/lib/data/detail'
import type { ContractView } from '@/lib/data/contracts'
import { formatTanggal, RFM_STATUSES, STATUS_BANDS, type RfmStatus, type StatusBand } from '@/lib/domain'

/**
 * Chart-shaped views of the contracts the caller can see.
 *
 * Everything here is a fold over the same `ContractView[]` the tables render, so a
 * chart and the list beneath it can never disagree, and reports obey the same access
 * rules as everything else without restating them.
 *
 * Every bucket also carries `items`: the contracts that fold into it, as drill-down
 * refs. One fold produces both the count a chart plots and the rows a click on that
 * bar has to show — so the two can never drift apart the way a second, hand-written
 * filter alongside the chart could.
 */

export const contractRef = (c: ContractView): DetailRef => ({
  kind: 'contract',
  id: c.id,
  label: `${c.customerName} — ${c.businessLine} · berakhir ${formatTanggal(c.contractEndDate)}`,
})

export const statusDistribution = (
  contracts: ContractView[],
): { name: StatusBand; value: number; items: DetailRef[] }[] =>
  STATUS_BANDS.map((band) => {
    const matching = contracts.filter((c) => c.status === band)
    return { name: band, value: matching.length, items: matching.map(contractRef) }
  })

export const countBy = <K extends string>(
  contracts: ContractView[],
  key: (contract: ContractView) => K,
): { name: string; value: number; items: DetailRef[] }[] => {
  const groups = new Map<string, ContractView[]>()
  for (const contract of contracts) {
    const k = key(contract)
    const existing = groups.get(k)
    if (existing) existing.push(contract)
    else groups.set(k, [contract])
  }
  return [...groups.entries()]
    .map(([name, rows]) => ({ name, value: rows.length, items: rows.map(contractRef) }))
    .sort((a, b) => b.value - a.value)
}

const MONTH_LABEL = new Intl.DateTimeFormat('id-ID', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
})

/**
 * Contracts due per calendar month, ascending. Months with no expiry are included so
 * a gap in the pipeline reads as a gap rather than as two adjacent busy months.
 */
export const expiryTimeline = (
  contracts: ContractView[],
): { bulan: string; jumlah: number; items: DetailRef[] }[] => {
  if (contracts.length === 0) return []

  const keyOf = (iso: string): string => iso.slice(0, 7)
  const byKey = new Map<string, ContractView[]>()
  for (const contract of contracts) {
    const key = keyOf(contract.contractEndDate)
    const existing = byKey.get(key)
    if (existing) existing.push(contract)
    else byKey.set(key, [contract])
  }

  const keys = [...byKey.keys()].sort()
  const [firstYear, firstMonth] = keys[0]!.split('-').map(Number)
  const [lastYear, lastMonth] = keys[keys.length - 1]!.split('-').map(Number)

  const timeline: { bulan: string; jumlah: number; items: DetailRef[] }[] = []
  const cursor = new Date(Date.UTC(firstYear!, firstMonth! - 1, 1))
  const end = Date.UTC(lastYear!, lastMonth! - 1, 1)

  while (cursor.getTime() <= end) {
    const key = cursor.toISOString().slice(0, 7)
    const rows = byKey.get(key) ?? []
    timeline.push({ bulan: MONTH_LABEL.format(cursor), jumlah: rows.length, items: rows.map(contractRef) })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return timeline
}

/**
 * GPM bucketed into five-point bands. Shows the spread the average hides — which
 * matters here, because the portfolio average sits comfortably above target while
 * one contract does not.
 */
export const marginDistribution = (
  contracts: ContractView[],
): { rentang: string; jumlah: number; items: DetailRef[] }[] => {
  if (contracts.length === 0) return []

  const bucketOf = (fraction: number): number => Math.floor((fraction * 100) / 5) * 5
  const byBucket = new Map<number, ContractView[]>()
  for (const c of contracts) {
    const bucket = bucketOf(c.margin.gpm)
    const existing = byBucket.get(bucket)
    if (existing) existing.push(c)
    else byBucket.set(bucket, [c])
  }
  const buckets = [...byBucket.keys()]
  const lowest = Math.min(...buckets)
  const highest = Math.max(...buckets)

  const distribution: { rentang: string; jumlah: number; items: DetailRef[] }[] = []
  for (let start = lowest; start <= highest; start += 5) {
    const rows = byBucket.get(start) ?? []
    distribution.push({ rentang: `${start}–${start + 5}%`, jumlah: rows.length, items: rows.map(contractRef) })
  }
  return distribution
}

/** Per-line margin health, for comparing which line runs the healthiest book. */
export const performanceByBusinessLine = (
  contracts: ContractView[],
): { businessLine: string; jumlah: number; rataGpm: number; dibawahTarget: number }[] => {
  const groups = new Map<string, ContractView[]>()
  for (const contract of contracts) {
    const existing = groups.get(contract.businessLine)
    if (existing) existing.push(contract)
    else groups.set(contract.businessLine, [contract])
  }

  return [...groups.entries()]
    .map(([businessLine, rows]) => ({
      businessLine,
      jumlah: rows.length,
      rataGpm: rows.reduce((sum, c) => sum + c.margin.gpm, 0) / rows.length,
      dibawahTarget: rows.filter((c) => !c.margin.meetsTarget).length,
    }))
    .sort((a, b) => b.rataGpm - a.rataGpm)
}

/**
 * Customer segmentation across the visible book, as the dashboard donut renders it.
 *
 * Every band is listed even at zero, so a portfolio with no MEDIUM customers reads as
 * "none" rather than as a segment nobody thought to measure.
 */
export const rfmDistribution = (
  contracts: ContractView[],
): { name: RfmStatus; value: number; items: DetailRef[] }[] =>
  RFM_STATUSES.map((status) => {
    const matching = contracts.filter((c) => c.rfmStatus === status)
    return { name: status, value: matching.length, items: matching.map(contractRef) }
  })

/**
 * Live against lapsed — the split the monitoring screen leads with.
 *
 * Keyed on `daysLeft`, the same derivation the status band and the reminder emails
 * use, so the donut and the table's badges cannot disagree.
 */
export const lifecycleDistribution = (
  contracts: ContractView[],
): { name: 'Aktif' | 'Expired'; value: number; items: DetailRef[] }[] => {
  const aktif = contracts.filter((c) => c.daysLeft >= 0)
  const expired = contracts.filter((c) => c.daysLeft < 0)
  return [
    { name: 'Aktif', value: aktif.length, items: aktif.map(contractRef) },
    { name: 'Expired', value: expired.length, items: expired.map(contractRef) },
  ]
}
