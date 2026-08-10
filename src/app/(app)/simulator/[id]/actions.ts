'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'

import { createClient } from '@/lib/supabase/server'

export interface ScenarioActionState {
  error: string | null
  message: string | null
}

const OK = (message: string): ScenarioActionState => ({ error: null, message })
const FAIL = (error: string): ScenarioActionState => ({ error, message: null })

/**
 * Saves a scenario as a draft against a contract.
 *
 * `author_id` is taken from the session rather than the form, and the insert policy
 * additionally requires it to match the caller — so a scenario cannot be filed in
 * someone else's name even if this action were called directly.
 */
export const saveScenario = async (
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> => {
  const contractId = String(formData.get('contract_id') ?? '')
  const nama = String(formData.get('nama') ?? '').trim()
  const proposedTarif = Number(formData.get('proposed_tarif'))
  const proposedCost = Number(formData.get('proposed_cost'))

  if (nama === '') return FAIL('Nama skenario wajib diisi.')
  if (!Number.isFinite(proposedTarif) || proposedTarif <= 0) {
    return FAIL('Tarif usulan harus lebih besar dari nol.')
  }
  if (!Number.isFinite(proposedCost) || proposedCost < 0) {
    return FAIL('Cost usulan tidak boleh negatif.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return FAIL('Sesi Anda telah berakhir. Silakan masuk kembali.')

  const { error } = await supabase.from('scenarios').insert({
    contract_id: contractId,
    nama,
    proposed_tarif: proposedTarif,
    proposed_cost: proposedCost,
    author_id: user.id,
  })

  if (error) {
    return FAIL(
      error.message.includes('row-level security')
        ? 'Anda tidak dapat membuat skenario untuk kontrak di luar lini bisnis Anda.'
        : `Gagal menyimpan skenario: ${error.message}`,
    )
  }

  revalidatePath(`/simulator/${contractId}`)
  return OK('Skenario tersimpan sebagai draft.')
}

/** draft → pending. The RLS policy restricts this to the scenario's own author. */
export const submitScenario = async (
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> => {
  const id = String(formData.get('scenario_id') ?? '')
  const contractId = String(formData.get('contract_id') ?? '')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('scenarios')
    .update({ status: 'pending' })
    .eq('id', id)
    .select('id')

  if (error) return FAIL(`Gagal mengajukan skenario: ${error.message}`)
  if (!data || data.length === 0) {
    return FAIL('Skenario ini tidak dapat diajukan — mungkin sudah diputuskan.')
  }

  revalidatePath(`/simulator/${contractId}`)
  revalidatePath('/persetujuan')
  return OK('Skenario diajukan untuk persetujuan VP.')
}

/**
 * pending → approved | rejected. Only a VP holds an update policy that selects a
 * pending row, and a rejection without a reason is refused by a check constraint.
 */
export const decideScenario = async (
  _prev: ScenarioActionState,
  formData: FormData,
): Promise<ScenarioActionState> => {
  const id = String(formData.get('scenario_id') ?? '')
  const decision = String(formData.get('decision') ?? '')
  const reason = String(formData.get('rejection_reason') ?? '').trim()

  if (decision !== 'approved' && decision !== 'rejected') {
    return FAIL('Keputusan tidak dikenali.')
  }
  if (decision === 'rejected' && reason === '') {
    return FAIL('Penolakan harus disertai alasan.')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return FAIL('Sesi Anda telah berakhir. Silakan masuk kembali.')

  const { data, error } = await supabase
    .from('scenarios')
    .update({
      status: decision,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      rejection_reason: decision === 'rejected' ? reason : null,
    })
    .eq('id', id)
    .select('id')

  if (error) return FAIL(`Gagal menyimpan keputusan: ${error.message}`)
  if (!data || data.length === 0) {
    return FAIL('Skenario ini sudah diputuskan atau bukan wewenang Anda.')
  }

  revalidatePath('/persetujuan')
  revalidatePath('/notifikasi')

  // A decided scenario leaves the queue, taking any message rendered inside its own
  // row with it. Carrying the outcome in the URL puts the confirmation on the page
  // that remains, so the VP is actually told what happened.
  redirect(`/persetujuan?keputusan=${decision}` as Route)
}
