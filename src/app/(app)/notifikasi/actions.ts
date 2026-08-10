'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Marking read is the only mutation a user has on a notification: a trigger holds the
 * update to the `read` column, and RLS holds it to their own rows.
 */
export const markRead = async (id: string): Promise<void> => {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read: true }).eq('id', id)
  revalidatePath('/notifikasi')
  revalidatePath('/', 'layout')
}

export const markAllRead = async (): Promise<void> => {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read: true }).eq('read', false)
  revalidatePath('/notifikasi')
  revalidatePath('/', 'layout')
}
