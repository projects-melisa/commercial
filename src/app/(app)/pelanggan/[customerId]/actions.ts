'use server'

import { revalidatePath } from 'next/cache'

import { requireGrant } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Logging and closing a service case — OCS KPS only, to write as well as to read.
 *
 * A Server Action is a POST endpoint, reachable by anyone holding a session whatever
 * page rendered the button. The database refuses these writes to everybody else
 * anyway, so the grant check here is not what makes them safe — it is what turns a
 * silent no-op into a refusal the caller can see. A button that appears to work and
 * quietly changes nothing is the worse failure.
 *
 * There is deliberately no delete: a case that happened happened, and closing it is
 * what "done" means.
 */
export const logCase = async (formData: FormData): Promise<void> => {
  await requireGrant('irregularities', 'input')

  const customerId = String(formData.get('customer_id') ?? '')
  const description = String(formData.get('description') ?? '').trim()
  if (description === '') return

  const supabase = await createClient()
  await supabase.from('cases').insert({ customer_id: customerId, description, status: 'OPEN' })
  revalidatePath(`/pelanggan/${customerId}`)
  revalidatePath('/pelanggan')
  revalidatePath('/irregularities')
}

export const toggleCase = async (formData: FormData): Promise<void> => {
  await requireGrant('irregularities', 'input')

  const customerId = String(formData.get('customer_id') ?? '')
  const supabase = await createClient()
  await supabase
    .from('cases')
    .update({ status: formData.get('status') === 'OPEN' ? 'CLOSED' : 'OPEN' })
    .eq('id', String(formData.get('case_id') ?? ''))
  revalidatePath(`/pelanggan/${customerId}`)
  revalidatePath('/pelanggan')
  revalidatePath('/irregularities')
}
