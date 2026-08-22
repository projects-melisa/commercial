import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ShieldCheck } from 'lucide-react'

import { CreateUserForm, UsersTable, type UserRow } from '@/app/(app)/pengguna/user-forms'
import { requireGrant } from '@/lib/auth'
import { BUSINESS_LINES, ROLE_LABELS, type UserRole } from '@/lib/domain'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

export const metadata = { title: 'Pengguna & Role — Gapura Commercial' }

const ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as UserRole[]).map((value) => ({
  value,
  label: ROLE_LABELS[value],
}))

/**
 * Email addresses and ban state, which live on `auth.users` rather than on `profiles`.
 *
 * The Admin API is the only way to read them, so this runs under the service role —
 * after `requireGrant` has already refused everyone else. The grant check is the whole
 * guard here, which is why nothing above it touches this key.
 */
const authFacts = async (): Promise<Map<string, { email: string; active: boolean }>> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return new Map()

  const service = createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await service.auth.admin.listUsers({ perPage: 200 })

  return new Map(
    (data?.users ?? []).map((user) => [
      user.id,
      {
        email: user.email ?? '—',
        // Supabase reports a ban as a future `banned_until`; the field is not in the
        // published types, so it is read off the record rather than asserted onto it.
        active: !(user as { banned_until?: string }).banned_until,
      },
    ]),
  )
}

export default async function PenggunaPage() {
  await requireGrant('pengguna', 'manage')

  const supabase = await createClient()
  const [{ data: profiles }, { data: stations }, { data: hubs }, auth] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nama, role, business_line, cabang, hub, berlaku_sampai')
      .order('nama'),
    supabase.from('cabang').select('kode').order('kode'),
    supabase.from('cabang').select('hub').not('hub', 'is', null).order('hub'),
    authFacts(),
  ])

  const users: UserRow[] = (profiles ?? []).map((profile) => ({
    id: profile.id,
    nama: profile.nama,
    email: auth.get(profile.id)?.email ?? '—',
    role: profile.role,
    businessLine: profile.business_line,
    cabang: profile.cabang,
    hub: profile.hub,
    berlakuSampai: profile.berlaku_sampai,
    active: auth.get(profile.id)?.active ?? true,
  }))

  const lines = [...BUSINESS_LINES]
  const kode = (stations ?? []).map((row) => row.kode)
  const daftarHub = [
    ...new Set(
      (hubs ?? []).map((row) => row.hub).filter((h): h is string => h !== null),
    ),
  ]

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-900">Pengguna &amp; Role</h1>
        <p className="mt-1 text-sm text-gray-400">
          {users.length} akun. Anda mengatur <strong>siapa memegang role apa</strong> — bukan apa
          yang boleh dilakukan sebuah role.
        </p>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Isi tabel <code>role_module_grants</code> hanya bisa diubah lewat migration, tidak dari
          halaman ini dan tidak oleh siapa pun. Kalau tabel itu bisa ditulis dari aplikasi, siapa
          pun yang menjangkaunya bisa memberi dirinya sendiri akses apa saja. Peran Anda sendiri
          juga tidak melihat satu baris pun data bisnis.
        </p>
      </div>

      <CreateUserForm roles={ROLE_OPTIONS} lines={lines} stations={kode} hubs={daftarHub} />

      <UsersTable users={users} roles={ROLE_OPTIONS} lines={lines} stations={kode} hubs={daftarHub} />
    </div>
  )
}
