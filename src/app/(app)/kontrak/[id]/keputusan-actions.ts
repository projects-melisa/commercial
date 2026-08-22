'use server'

import { revalidatePath } from 'next/cache'

import { may, requireGrant } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * U-1 · the renew decision gets a record, not just an audience.
 *
 * The requirement's own words: "mempercepat keputusan renew/no-renew". Everything that
 * feeds the decision is already on this page; what was missing was anywhere to put the
 * decision itself. The table has no tab in the Sheet, so — like scenarios — it is safe
 * to write from here without the nightly pull overwriting it.
 */

export interface KeputusanRow {
  id: string
  keputusan: string
  alasan: string
  olehNama: string
  pada: string
}

export const listKeputusan = async (contractId: string): Promise<KeputusanRow[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contract_decisions')
    .select('id, keputusan, alasan, pada, profiles_ringkas!contract_decisions_oleh_fkey(nama)')
    .eq('contract_id', contractId)
    .order('pada', { ascending: false })

  return (data ?? []).map((row) => ({
    id: row.id,
    keputusan: row.keputusan,
    alasan: row.alasan,
    // The view returns one row per decision through the FK; PostgREST hands it back
    // as either an object or an array depending on cardinality detection.
    olehNama:
      (Array.isArray(row.profiles_ringkas) ? row.profiles_ringkas[0]?.nama : row.profiles_ringkas?.nama) ??
      '—',
    pada: row.pada,
  }))
}

export interface KeputusanState {
  error: string | null
  ok: string | null
}

export const recordKeputusan = async (
  _prev: KeputusanState,
  formData: FormData,
): Promise<KeputusanState> => {
  try {
    const { profile, grants } = await requireGrant('kontrak', 'view')
    const boleh = may(grants, 'keputusan', 'input') || may(grants, 'keputusan', 'approve')
    if (!boleh) throw new Error('Tidak berwenang mencatat keputusan')

    const contractId = String(formData.get('contract_id') ?? '')
    const keputusan = String(formData.get('keputusan') ?? '')
    const alasan = String(formData.get('alasan') ?? '').trim()
    if (!contractId || !['renew', 'no_renew', 'renegosiasi'].includes(keputusan)) {
      return { error: 'Keputusan tidak dikenali.', ok: null }
    }
    if (alasan === '') return { error: 'Alasan wajib diisi.', ok: null }

    const supabase = await createClient()
    // RLS pins `oleh` to the session and scope-checks the contract; zero rows or an
    // error both mean refused, and neither may read as recorded.
    const { data, error } = await supabase
      .from('contract_decisions')
      .insert({ contract_id: contractId, keputusan, alasan, oleh: profile.id })
      .select('id')
    if (error) return { error: error.message, ok: null }
    if ((data ?? []).length === 0) return { error: 'Keputusan tidak tercatat.', ok: null }

    revalidatePath(`/kontrak/${contractId}`)
    return { error: null, ok: 'Keputusan tercatat.' }
  } catch (error) {
    return { error: (error as Error).message, ok: null }
  }
}
