'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

/**
 * Fires a reminder for one contract on demand.
 *
 * Calls `send_expiry_reminders`, the same function the daily pg_cron job runs, so the
 * demo path and the scheduled path cannot select contracts differently. Idempotency
 * is enforced inside that function: pressing this twice for the same milestone writes
 * one notification.
 */
export const sendReminder = async (contractId: string): Promise<string> => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('send_expiry_reminders', {
    target_contract_id: contractId,
  })

  if (error) return `Gagal mengirim reminder: ${error.message}`

  revalidatePath('/notifikasi')
  revalidatePath('/kritis')

  const written = (data ?? []).filter((row) => row.notification_id !== null).length
  return written > 0
    ? 'Reminder terkirim dan tercatat di pusat notifikasi.'
    : 'Reminder untuk milestone ini sudah pernah dikirim.'
}
