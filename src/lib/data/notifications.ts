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
 * The most recent Google Sheets pull, folded from its per-tab rows, or null if it has
 * never run.
 *
 * Readable by every signed-in user: the log carries counts and timestamps, never
 * commercial terms, and a pull that has silently stopped running has to be visible to
 * the people relying on the figures.
 *
 * One run writes one row per tab, and a run is only "ok" if every tab was. Reading the
 * single newest row instead would report success whenever the last tab happened to
 * succeed, which is precisely the failure the log exists to surface.
 */
export const getLastSheetSync = async (): Promise<SheetSync | null> => {
  const supabase = await createClient()
  // A run covers a handful of tabs; twenty is far more than one can produce and still
  // bounded if the schema ever grows more of them.
  const { data } = await supabase
    .from('sheet_syncs')
    .select('status, trigger, rows_written, error, finished_at, started_at')
    .order('started_at', { ascending: false })
    .limit(20)

  const newest = data?.[0]
  if (!newest) return null
  const run = data.filter((row) => row.started_at === newest.started_at)

  return {
    status: run.every((row) => row.status === 'ok') ? 'ok' : 'failed',
    trigger: newest.trigger,
    rows_written: run.reduce((total, row) => total + row.rows_written, 0),
    error: run.find((row) => row.error !== null)?.error ?? null,
    finished_at: run.reduce(
      (latest, row) => (row.finished_at > latest ? row.finished_at : latest),
      newest.finished_at,
    ),
  }
}
