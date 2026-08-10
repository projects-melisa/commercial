'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Service cases were read-only reference data because no role owned case entry.
 * Commercial owns it now: they can log one and close it. There is deliberately no
 * delete — a case that happened happened, and closing it is what "done" means.
 */
export const logCase = async (formData: FormData): Promise<void> => {
  const customerId = String(formData.get('customer_id') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  if (description === '') return

  const supabase = await createClient()
  await supabase.from('cases').insert({ customer_id: customerId, description, status: 'OPEN' })
  revalidatePath(`/pelanggan/${customerId}`)
  revalidatePath('/pelanggan')
}

export const toggleCase = async (formData: FormData): Promise<void> => {
  const customerId = String(formData.get('customer_id') ?? '')
  const supabase = await createClient()
  await supabase
    .from('cases')
    .update({ status: formData.get('status') === 'OPEN' ? 'CLOSED' : 'OPEN' })
    .eq('id', String(formData.get('case_id') ?? ''))
  revalidatePath(`/pelanggan/${customerId}`)
  revalidatePath('/pelanggan')
}
