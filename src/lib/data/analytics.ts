import type { ContractView } from '@/lib/data/contracts'
import { STATUS_BANDS, type StatusBand } from '@/lib/domain'

/**
 * Chart-shaped views of the contracts the caller can see.
 *
 * Everything here is a fold over the same `ContractView[]` the tables render, so a
 * chart and the list beneath it can never disagree, and reports obey the same access
 * rules as everything else without restating them.
 */

export const statusDistribution = (
  contracts: ContractView[],
): { name: StatusBand; value: number }[] =>
  STATUS_BANDS.map((band) => ({
    name: band,
    value: contracts.filter((c) => c.status === band).length,
  }))

export const countBy = <K extends string>(
  contracts: ContractView[],
  key: (contract: ContractView) => K,
): { name: string; value: number }[] => {
  const counts = new Map<string, number>()
  for (const contract of contracts) {
    const k = key(contract)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
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
export const expiryTimeline = (contracts: ContractView[]): { bulan: string; jumlah: number }[] => {
  if (contracts.length === 0) return []

  const keyOf = (iso: string): string => iso.slice(0, 7)
  const counts = new Map<string, number>()
  for (const contract of contracts) {
    const key = keyOf(contract.contractEndDate)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const keys = [...counts.keys()].sort()
  const [firstYear, firstMonth] = keys[0]!.split('-').map(Number)
  const [lastYear, lastMonth] = keys[keys.length - 1]!.split('-').map(Number)

  const timeline: { bulan: string; jumlah: number }[] = []
  const cursor = new Date(Date.UTC(firstYear!, firstMonth! - 1, 1))
  const end = Date.UTC(lastYear!, lastMonth! - 1, 1)

  while (cursor.getTime() <= end) {
    const key = cursor.toISOString().slice(0, 7)
    timeline.push({ bulan: MONTH_LABEL.format(cursor), jumlah: counts.get(key) ?? 0 })
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
): { rentang: string; jumlah: number }[] => {
  if (contracts.length === 0) return []

  const bucketOf = (fraction: number): number => Math.floor((fraction * 100) / 5) * 5
  const buckets = contracts.map((c) => bucketOf(c.margin.gpm))
  const lowest = Math.min(...buckets)
  const highest = Math.max(...buckets)

  const counts = new Map<number, number>()
  for (const bucket of buckets) counts.set(bucket, (counts.get(bucket) ?? 0) + 1)

  const distribution: { rentang: string; jumlah: number }[] = []
  for (let start = lowest; start <= highest; start += 5) {
    distribution.push({ rentang: `${start}–${start + 5}%`, jumlah: counts.get(start) ?? 0 })
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
