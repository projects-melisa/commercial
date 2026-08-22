import { createClient } from '@/lib/supabase/server'
import { requireGrant } from '@/lib/auth'
import { AuditTable } from './audit-table'

export const metadata = { title: 'Jejak Audit — Gapura Commercial' }

/**
 * U-3 · the audit trail, readable by exactly the roles the grant table names.
 *
 * Every row here was written by a trigger or by log_activity() at export time; no
 * policy lets anyone write or delete, super admin included. The page's only job is to
 * make the trail visible: "hak akses diputus database" becomes provable the moment
 * someone can read who did what, when.
 */
export default async function AuditPage() {
  await requireGrant('audit', 'view')

  const supabase = await createClient()
  const { data } = await supabase
    .from('activity_log')
    .select('pada, aksi, detail, profiles_ringkas!activity_log_aktor_fkey(nama)')
    .order('pada', { ascending: false })
    .limit(300)

  const rows = (data ?? []).map((row) => ({
    pada: row.pada,
    aksi: row.aksi,
    detail: row.detail,
    nama: (Array.isArray(row.profiles_ringkas) ? row.profiles_ringkas[0]?.nama : row.profiles_ringkas?.nama) ?? '(sistem)',
  }))

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-900">Jejak Audit</h1>
        <p className="mt-1 text-sm text-gray-400">
          {rows.length} peristiwa terakhir. Ditulis oleh trigger dan ekspor — tidak ada
          yang bisa mengubah atau menghapusnya dari aplikasi ini, termasuk Anda.
        </p>
      </header>

      <AuditTable rows={rows} />
    </div>
  )
}
