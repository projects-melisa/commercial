'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { Route } from 'next'

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
  const next = String(formData.get('next') ?? '/')

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
  // the guard above is what makes it safe.
  const destination = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  redirect(destination as Route)
}

export const signOut = async (): Promise<void> => {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/masuk')
}
