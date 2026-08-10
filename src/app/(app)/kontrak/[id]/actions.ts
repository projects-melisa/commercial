'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { formatPercent, gpm, meetsTarget } from '@/lib/domain'

export interface EditContractState {
  error: string | null
  /** Set when the save succeeded but the new terms breach the contract's own target. */
  warning: string | null
  ok: boolean
}

const parseAmount = (raw: FormDataEntryValue | null): number | null => {
  const value = Number(String(raw ?? '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(value) ? value : null
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Updates a contract's commercial terms.
 *
 * Validation here is for the person filling the form. The database enforces the same
 * invariants as check constraints, and RLS decides whether this caller may touch this
 * row at all — a Commercial user editing outside their line updates nothing, and a VP
 * updates nothing at all.
 */
export const updateContract = async (
  _prev: EditContractState,
  formData: FormData,
): Promise<EditContractState> => {
  const id = String(formData.get('id') ?? '')
  const tarif = parseAmount(formData.get('tarif'))
  const cost = parseAmount(formData.get('cost'))
  const contractEndDate = String(formData.get('contract_end_date') ?? '')
  const acknowledgedBreach = formData.get('acknowledge_breach') === 'on'

  if (tarif === null || tarif <= 0) {
    return { error: 'Tarif harus berupa angka lebih besar dari nol.', warning: null, ok: false }
  }
  if (cost === null || cost < 0) {
    return { error: 'Cost tidak boleh negatif.', warning: null, ok: false }
  }
  if (cost >= tarif) {
    return {
      error: 'Cost harus lebih kecil dari tarif, jika tidak margin menjadi nol atau negatif.',
      warning: null,
      ok: false,
    }
  }
  if (!ISO_DATE.test(contractEndDate)) {
    return { error: 'Tanggal berakhir tidak valid.', warning: null, ok: false }
  }

  const supabase = await createClient()

  const { data: existing, error: readError } = await supabase
    .from('contracts')
    .select('min_gpm_target')
    .eq('id', id)
    .maybeSingle()

  if (readError) {
    return { error: `Gagal membaca kontrak: ${readError.message}`, warning: null, ok: false }
  }
  if (!existing) {
    return {
      error: 'Kontrak ini tidak ada dalam cakupan akses Anda.',
      warning: null,
      ok: false,
    }
  }

  const target = Number(existing.min_gpm_target)
  const proposed = gpm(tarif, cost)
  const breaches = !meetsTarget(proposed, target)

  // Warn once, then let the user proceed deliberately. The target is a commercial
  // floor rather than a hard constraint, so the system flags it instead of blocking.
  if (breaches && !acknowledgedBreach) {
    return {
      error: null,
      warning:
        `Perubahan ini menurunkan GPM menjadi ${formatPercent(proposed)}, ` +
        `di bawah target kontrak ini sebesar ${formatPercent(target)}. ` +
        'Centang konfirmasi di bawah untuk tetap menyimpan.',
      ok: false,
    }
  }

  const { data, error } = await supabase
    .from('contracts')
    .update({ tarif, cost, contract_end_date: contractEndDate })
    .eq('id', id)
    .select('id')

  if (error) {
    return { error: `Gagal menyimpan: ${error.message}`, warning: null, ok: false }
  }
  // An empty result means RLS refused the row rather than that the row is missing.
  if (!data || data.length === 0) {
    return {
      error: 'Anda tidak memiliki hak untuk mengubah kontrak ini.',
      warning: null,
      ok: false,
    }
  }

  revalidatePath('/kontrak')
  revalidatePath(`/kontrak/${id}`)
  revalidatePath('/')

  return { error: null, warning: null, ok: true }
}
