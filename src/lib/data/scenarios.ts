import { createClient } from '@/lib/supabase/server'
import type { ScenarioRow } from '@/lib/supabase/types'
import type { BusinessLine } from '@/lib/domain'

export interface ScenarioView extends ScenarioRow {
  authorName: string
  deciderName: string | null
  contract: {
    id: string
    customerName: string
    businessLine: BusinessLine
    tarif: number
    cost: number
    minGpmTarget: number
  }
}

const SELECT = `
  *,
  author:profiles!scenarios_author_id_fkey(nama),
  decider:profiles!scenarios_decided_by_fkey(nama),
  contracts!inner(id, business_line, tarif, cost, min_gpm_target, customers!inner(nama))
`

interface RawScenario extends ScenarioRow {
  author: { nama: string } | null
  decider: { nama: string } | null
  contracts: {
    id: string
    business_line: BusinessLine
    tarif: number
    cost: number
    min_gpm_target: number
    customers: { nama: string } | null
  }
}

const toView = (row: RawScenario): ScenarioView => ({
  ...row,
  authorName: row.author?.nama ?? 'Tidak diketahui',
  deciderName: row.decider?.nama ?? null,
  contract: {
    id: row.contracts.id,
    customerName: row.contracts.customers?.nama ?? '—',
    businessLine: row.contracts.business_line,
    tarif: Number(row.contracts.tarif),
    cost: Number(row.contracts.cost),
    minGpmTarget: Number(row.contracts.min_gpm_target),
  },
})

/** Scenarios saved against one contract. Scoped by RLS through the contract. */
export const listScenariosForContract = async (contractId: string): Promise<ScenarioView[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scenarios')
    .select(SELECT)
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Gagal memuat skenario: ${error.message}`)
  return (data as unknown as RawScenario[]).map(toView)
}

/** The VP's decision queue: everything submitted and not yet decided. */
export const listPendingScenarios = async (): Promise<ScenarioView[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scenarios')
    .select(SELECT)
    .eq('status', 'pending')
    .order('created_at')

  if (error) throw new Error(`Gagal memuat antrean persetujuan: ${error.message}`)
  return (data as unknown as RawScenario[]).map(toView)
}
