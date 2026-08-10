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
