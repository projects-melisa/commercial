'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'

import { getGrants, may, requireProfile } from '@/lib/auth'
import type { Database } from '@/lib/supabase/database.types'

type UserRole = Database['public']['Enums']['user_role']
type BusinessLine = Database['public']['Enums']['business_line']

export interface UserActionState {
  error: string | null
  ok: string | null
}

/**
 * A service-role client, created per call and never exported.
 *
 * Creating an auth user and banning one are Admin API operations: no RLS policy can
 * express them, so the service role is the only way. That makes the authorisation
 * check below the *entire* guard, which is why it is the first thing every action
 * does and why the client is built after it rather than before.
 */
const admin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  return createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Refuses unless the caller holds `pengguna:manage`.
 *
 * Read from the grant table, not from a role name. The same row drives the navigation
 * entry and the RLS policy on `profiles`, so an offered link and an accepted write
 * cannot disagree — and a tenth role needs an insert, not an edit here.
 */
const requireManage = async (): Promise<void> => {
  const profile = await requireProfile()
  if (!may(await getGrants(profile.role), 'pengguna', 'manage')) {
    throw new Error('Tidak berwenang mengelola pengguna')
  }
}

const text = (form: FormData, key: string): string => String(form.get(key) ?? '').trim()

const scopeFrom = (form: FormData) => {
  const role = text(form, 'role') as UserRole
  const line = text(form, 'business_line')
  const cabang = text(form, 'cabang')
  const hub = text(form, 'hub')
  const berlaku = text(form, 'berlaku_sampai')

  // A station-scoped profile carries no business line, deliberately: `in_caller_scope`
  // reads null on an axis as "all of them", which is what makes a GM Cabang cover every
  // line at their own airport. Sending both would narrow them twice over. A hub goes
  // only to station-less regional profiles, by the same convention.
  return {
    role,
    business_line: cabang !== '' ? null : ((line || null) as BusinessLine | null),
    cabang: cabang || null,
    hub: cabang === '' && line === '' ? hub || null : null,
    berlaku_sampai: berlaku || null,
  }
}

/**
 * R-3 · refuses the update that would retire the last active super admin.
 *
 * One such account exists in production today. Letting it demote itself locks user
 * management behind a psql prompt forever, so the check runs before the write, against
 * ban state read from the Admin API — a disabled account is not a lifeline.
 */
const lastSuperAdminStanding = async (
  service: ReturnType<typeof admin>,
  targetId: string,
  newRole: UserRole,
): Promise<boolean> => {
  if (newRole === 'super_admin') return false
  const { data } = await service.from('profiles').select('id').eq('role', 'super_admin')
  const others = (data ?? []).filter((a) => a.id !== targetId)
  if (others.length === 0) return true

  // A replacement counts only if its account can actually sign in.
  const { data: listed } = await service.auth.admin.listUsers({ perPage: 500 })
  const banned = new Set(
    (listed?.users ?? [])
      .filter((u) => Boolean((u as { banned_until?: string }).banned_until))
      .map((u) => u.id),
  )
  return others.every((a) => banned.has(a.id))
}

export const updateUser = async (
  _prev: UserActionState,
  form: FormData,
): Promise<UserActionState> => {
  try {
    await requireManage()
    const id = text(form, 'id')
    if (!id) return { error: 'Pengguna tidak dikenali.', ok: null }

    const scope = scopeFrom(form)
    const service = admin()
    if (await lastSuperAdminStanding(service, id, scope.role)) {
      return {
        error: 'Ini super admin aktif terakhir. Role-nya tidak boleh dilepas sebelum ada penggantinya.',
        ok: null,
      }
    }

    const { error } = await service.from('profiles').update(scope).eq('id', id)
    if (error) return { error: error.message, ok: null }

    revalidatePath('/pengguna')
    return { error: null, ok: 'Perubahan tersimpan.' }
  } catch (error) {
    return { error: (error as Error).message, ok: null }
  }
}

export const createUser = async (
  _prev: UserActionState,
  form: FormData,
): Promise<UserActionState> => {
  try {
    await requireManage()
    const email = text(form, 'email').toLowerCase()
    const nama = text(form, 'nama')
    const password = String(form.get('password') ?? '')

    if (!email || !nama) return { error: 'Nama dan email wajib diisi.', ok: null }
    if (password.length < 8) {
      return { error: 'Kata sandi minimal 8 karakter.', ok: null }
    }

    const service = admin()
    const { data: created, error: authError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError || !created.user) {
      return { error: authError?.message ?? 'Gagal membuat akun.', ok: null }
    }

    const { error: profileError } = await service
      .from('profiles')
      .insert({ id: created.user.id, nama, ...scopeFrom(form) })
    if (profileError) {
      // A login with no profile cannot be scoped, so the app treats it as no session
      // at all — an account nobody can use and nobody can see. Undo rather than leave
      // it behind.
      await service.auth.admin.deleteUser(created.user.id)
      return { error: profileError.message, ok: null }
    }

    revalidatePath('/pengguna')
    return { error: null, ok: `Akun ${email} dibuat.` }
  } catch (error) {
    return { error: (error as Error).message, ok: null }
  }
}

export const setUserActive = async (
  _prev: UserActionState,
  form: FormData,
): Promise<UserActionState> => {
  try {
    await requireManage()
    const id = text(form, 'id')
    const activate = text(form, 'activate') === 'true'

    // Deactivation is a ban, not a delete. Deleting the auth user would cascade the
    // profile away and take the audit trail with it — who approved which scenario,
    // who a notification was addressed to.
    const { error } = await admin().auth.admin.updateUserById(id, {
      ban_duration: activate ? 'none' : '876000h',
    })
    if (error) return { error: error.message, ok: null }

    revalidatePath('/pengguna')
    return { error: null, ok: activate ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.' }
  } catch (error) {
    return { error: (error as Error).message, ok: null }
  }
}
