'use server'

import { revalidatePath } from 'next/cache'

import { requireGrant } from '@/lib/auth'
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

/**
 * Records that this renewal was chased, so the queue stops looking untouched.
 *
 * `followed_up_at` is the only column of `contracts` an authenticated session may
 * write, enforced by a column grant rather than by this code — everything else about a
 * contract belongs to the Sheet. Between withdrawing contract CRUD and adding that
 * grant, this action wrote nothing at all and said nothing about it: an update with no
 * matching policy affects zero rows and raises no error.
 */
export const markFollowedUp = async (formData: FormData): Promise<void> => {
  await requireGrant('kontrak', 'view')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contracts')
    .update({ followed_up_at: new Date().toISOString() })
    .eq('id', String(formData.get('contract_id') ?? ''))
    .select('id')

  // Zero rows means the policy refused it. Log rather than swallow: the button is
  // about to render as though the follow-up was recorded.
  if (error || (data ?? []).length === 0) {
    console.error('[kritis] follow-up not recorded', error?.message ?? 'no rows matched')
  }
  revalidatePath('/kritis')
}
