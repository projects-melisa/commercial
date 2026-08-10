import { createClient } from '@/lib/supabase/server'
import {
  daysRemaining,
  marginHealth,
  statusBand,
  todayInJakarta,
  type BusinessLine,
  type MarginHealth,
  type RfmStatus,
  type StatusBand,
} from '@/lib/domain'
import type { CaseRow, ContractRow } from '@/lib/supabase/types'

/**
 * A contract as every screen consumes it: the stored row, its customer, and the
 * values derived from both. No screen recomputes GPM or a status band for itself.
 */
export interface ContractView {
  id: string
  customerId: string
  customerName: string
  rfmStatus: RfmStatus
  businessLine: BusinessLine
  serviceType: string
  contractEndDate: string
  sourceEndDate: string
  tarif: number
  cost: number
  minGpmTarget: number
  daysLeft: number
  status: StatusBand
  margin: MarginHealth
  openCaseCount: number
  /** The term this contract held before it was last renewed, if it ever was. */
  previousEndDate: string | null
  /** When someone last recorded chasing this renewal. */
  followedUpAt: string | null
  /** When the row last changed, for reporting how current the figures are. */
  updatedAt: string
}

interface ContractWithCustomer extends ContractRow {
  customers: { nama: string; rfm_status: RfmStatus } | null
}

const toView = (
  row: ContractWithCustomer,
  openCaseCounts: Map<string, number>,
  today: string,
): ContractView => {
  const daysLeft = daysRemaining(row.contract_end_date, today)
  return {
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customers?.nama ?? row.customer_id,
    rfmStatus: row.customers?.rfm_status ?? 'LOW',
    businessLine: row.business_line,
    serviceType: row.service_type,
    contractEndDate: row.contract_end_date,
    sourceEndDate: row.source_end_date,
    tarif: Number(row.tarif),
    cost: Number(row.cost),
    minGpmTarget: Number(row.min_gpm_target),
    daysLeft,
    status: statusBand(daysLeft),
    margin: marginHealth(Number(row.tarif), Number(row.cost), Number(row.min_gpm_target)),
    openCaseCount: openCaseCounts.get(row.customer_id) ?? 0,
    previousEndDate: row.previous_end_date,
    followedUpAt: row.followed_up_at,
    updatedAt: row.updated_at,
  }
}

const SELECT = '*, customers!inner(nama, rfm_status)'

/**
 * Every contract the caller may see — 20 for a VP, 8 / 7 / 5 for a Commercial user.
 * There is deliberately no business-line filter here: the RLS policy decides, so a
 * mistake in this query cannot widen anyone's scope.
 */
export const listContracts = async (): Promise<ContractView[]> => {
  const supabase = await createClient()
  const today = todayInJakarta()

  const [contracts, cases] = await Promise.all([
    supabase.from('contracts').select(SELECT).order('contract_end_date'),
    supabase.from('cases').select('customer_id, status').eq('status', 'OPEN'),
  ])

  if (contracts.error) throw new Error(`Gagal memuat kontrak: ${contracts.error.message}`)
  if (cases.error) throw new Error(`Gagal memuat kasus layanan: ${cases.error.message}`)

  const openCaseCounts = new Map<string, number>()
  for (const row of cases.data ?? []) {
    openCaseCounts.set(row.customer_id, (openCaseCounts.get(row.customer_id) ?? 0) + 1)
  }

  return (contracts.data as unknown as ContractWithCustomer[]).map((row) =>
    toView(row, openCaseCounts, today),
  )
}

export const getContract = async (id: string): Promise<ContractView | null> => {
  const supabase = await createClient()
  const today = todayInJakarta()

  const { data, error } = await supabase.from('contracts').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(`Gagal memuat kontrak: ${error.message}`)
  if (!data) return null

  const row = data as unknown as ContractWithCustomer
  const { data: cases } = await supabase
    .from('cases')
    .select('customer_id, status')
    .eq('customer_id', row.customer_id)
    .eq('status', 'OPEN')

  return toView(row, new Map([[row.customer_id, cases?.length ?? 0]]), today)
}

export const listCasesForCustomer = async (customerId: string): Promise<CaseRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('customer_id', customerId)
    // Open cases first: they are what a negotiation will run into.
    .order('status')
  if (error) throw new Error(`Gagal memuat kasus layanan: ${error.message}`)
  return data ?? []
}

/**
 * The headline figures. Computed from exactly the rows the caller can see, so they
 * always agree with the table beneath them.
 */
export interface PortfolioSummary {
  totalContracts: number
  dueWithin60Days: number
  expired: number
  averageGpm: number
  belowTarget: number
  byStatus: Record<StatusBand, number>
}

export const summarise = (contracts: ContractView[]): PortfolioSummary => {
  const byStatus: Record<StatusBand, number> = {
    Aman: 0,
    'Perlu Perhatian': 0,
    Kritis: 0,
    Nonaktif: 0,
  }
  for (const contract of contracts) byStatus[contract.status] += 1

  const total = contracts.length
  const gpmSum = contracts.reduce((sum, contract) => sum + contract.margin.gpm, 0)

  return {
    totalContracts: total,
    // Expired contracts are counted separately, so "due within 60 days" means work
    // that can still be done rather than work already missed.
    dueWithin60Days: contracts.filter((c) => c.daysLeft >= 0 && c.daysLeft <= 60).length,
    expired: contracts.filter((c) => c.daysLeft < 0).length,
    averageGpm: total > 0 ? gpmSum / total : 0,
    belowTarget: contracts.filter((c) => !c.margin.meetsTarget).length,
    byStatus,
  }
}
