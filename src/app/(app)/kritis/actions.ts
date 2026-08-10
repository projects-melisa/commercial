'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

interface ReminderResult {
  written: number
  emailed: number
  failures?: string[]
}

/**
 * Fires a reminder for one contract on demand.
 *
 * Invokes the `send-reminders` Edge Function — the same function the daily pg_cron
 * job runs — so the demo path and the scheduled path cannot select contracts, word
 * the email, or apply the recipient override differently.
 *
 * The caller's session is forwarded, so the function's selection query runs under
 * their identity and a Commercial user still cannot prompt outside their own line.
 */
export const sendReminder = async (contractId: string): Promise<string> => {
  const supabase = await createClient()

  const { data, error } = await supabase.functions.invoke<ReminderResult>('send-reminders', {
    body: { contract_id: contractId },
  })

  if (error) {
    // Email is a convenience; the notification centre is the system of record. Say
    // plainly that delivery failed rather than implying nothing happened.
    return `Reminder tidak dapat dikirim lewat email: ${error.message}. Periksa konfigurasi SMTP.`
  }

  revalidatePath('/notifikasi')
  revalidatePath('/kritis')

  if (!data || (data.written === 0 && data.emailed === 0)) {
    return 'Reminder untuk milestone ini sudah pernah dikirim.'
  }

  if (data.emailed > 0) {
    return `Reminder terkirim lewat email dan tercatat di pusat notifikasi.`
  }

  return 'Reminder tercatat di pusat notifikasi; pengiriman email belum dikonfigurasi.'
}
