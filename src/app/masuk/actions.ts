'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'

import { getGrants, getProfile, landingFor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export interface SignInState {
  error: string | null
}

/**
 * Signs in with the submitted credentials and nothing else.
 *
 * The form's persona picker only fills these two fields. No role, business line or
 * scope is accepted from the client: what the session may see is decided by the
 * `profiles` row for the authenticated user and enforced by RLS.
 */
export const signIn = async (_prev: SignInState, formData: FormData): Promise<SignInState> => {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const next = String(formData.get('next') ?? '')

  if (!email || !password) {
    return { error: 'Email dan kata sandi wajib diisi.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email atau kata sandi salah. Silakan periksa kembali.' }
  }

  revalidatePath('/', 'layout')

  // Only ever redirect within the application, so `next` cannot send a user offsite.
  // The cast is needed because typedRoutes cannot know a runtime string is a route;
  // the guard is what makes it safe.
  //
  // With no `next`, the destination comes from the caller's grants rather than being
  // hardcoded to `/`: the contract dashboard is a 404 for a GM Cabang and for a super
  // admin, so landing everyone there would have greeted two of the nine roles with a
  // missing page on every sign-in.
  const safe = next.startsWith('/') && !next.startsWith('//')
  if (safe) redirect(next as Route)

  const profile = await getProfile()
  redirect(profile ? landingFor(await getGrants(profile.role)) : '/masuk')
}

export const signOut = async (): Promise<void> => {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/masuk')
}
