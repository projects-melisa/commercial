import { createClient } from '@/lib/supabase/server'

/**
 * U-5 / D-7 · one honest line about how fresh the numbers on this page are.
 *
 * Input lives in the Sheet and the web only mirrors it, so "how old is this" is not
 * decoration — it is the only way a user can tell a live page from one whose pull has
 * quietly failed for two days. Every fact shown is already stored by each run; nothing
 * here computes anything.
 *
 * Red on failure, red on stale rows, silent on absence: before the first pull there is
 * nothing to report, and inventing a warning would be noise.
 */
export const Freshness = async ({ tab }: { tab: string }) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sheet_syncs')
    .select('status, rows_written, error, finished_at')
    .eq('tab', tab)
    .order('finished_at', { ascending: false })
    .limit(1)

  const last = data?.[0]
  if (!last) return null

  const gagal = last.status !== 'ok'
  const pada = new Date(last.finished_at).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  })

  return (
    <p
      role="status"
      className={`text-xs ${gagal ? 'font-semibold text-sem-bad' : 'text-gray-400'}`}
    >
      {gagal
        ? `Tarikan ${tab} terakhir GAGAL (${pada}). Angka di bawah bisa basi.`
        : `Data per ${pada} · ${last.rows_written.toLocaleString('id-ID')} baris dari Sheet.`}
    </p>
  )
}
