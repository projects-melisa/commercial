import { createClient } from '@/lib/supabase/server'
import type { NotificationRow } from '@/lib/supabase/types'

/**
 * Notifications are scoped to the recipient by RLS, so these queries never filter by
 * user themselves.
 */

export const countUnreadNotifications = async (): Promise<number> => {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)
  return count ?? 0
}

export const listNotifications = async (): Promise<NotificationRow[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Gagal memuat notifikasi: ${error.message}`)
  return data ?? []
}

export interface SheetSync {
  status: 'ok' | 'failed'
  trigger: 'schedule' | 'manual'
  rows_written: number
  error: string | null
  finished_at: string
}

/**
 * The most recent Google Sheets mirror run, or null if it has never run.
 *
 * Readable by every signed-in user: the log carries counts and timestamps, never
 * commercial terms, and a mirror that has silently stopped refreshing has to be
 * visible to the people relying on the sheet.
 */
export const getLastSheetSync = async (): Promise<SheetSync | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sheet_syncs')
    .select('status, trigger, rows_written, error, finished_at')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}
