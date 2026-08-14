import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../src/lib/demo-accounts.ts'
import type { BusinessLine } from '../../src/lib/domain.ts'
import type { Database } from '../../src/lib/supabase/database.types.ts'

export type Client = SupabaseClient<Database>

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const anonOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const

/** A client carrying no session at all — the unauthenticated caller. */
export const anonClient = (): Client => createClient<Database>(url(), anonKey(), anonOptions)

/**
 * A client authenticated as one of the seeded users, using the anon key exactly as
 * the browser does. Nothing here elevates privileges, so what these tests see is
 * what that person's session sees.
 *
 * Sessions are cached per persona. There are only four accounts and every test wants
 * one of them, so signing in afresh each time bought nothing and — against a hosted
 * project, which rate-limits its token endpoint — cost the suite its later tests.
 * Reusing a session is also closer to what a real user's browser does.
 */
const sessions = new Map<string, Promise<Client>>()

export const signInAs = (email: string): Promise<Client> => {
  const cached = sessions.get(email)
  if (cached) return cached

  const pending = (async () => {
    const client = createClient<Database>(url(), anonKey(), anonOptions)
    const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
    if (error) {
      sessions.delete(email)
      throw new Error(`could not sign in as ${email}: ${error.message}`)
    }
    return client
  })()

  sessions.set(email, pending)
  return pending
}

/**
 * The three seeded logins, one per role. Neither VP nor Commercial is confined: the VP
 * monitors the whole portfolio and the Commercial user manages all of it. The GM
 * Cabang is confined to one station and is the seeded account that shows a boundary.
 */
export const ACCOUNTS = {
  vp: DEMO_ACCOUNTS.find((a) => a.role === 'vp')!,
  commercial: DEMO_ACCOUNTS.find((a) => a.role === 'commercial')!,
  cabang: DEMO_ACCOUNTS.find((a) => a.role === 'cabang')!,
}

/**
 * The seeded GM Cabang's station, and how many contract lines they can see.
 *
 * Three lines sit at CGK itself; six more are the Sheet's "All Station" work, which
 * belongs to every airport and is therefore theirs too.
 */
export const SCOPED_CABANG = 'CGK' as const
export const CONTRACTS_AT_SCOPED_CABANG = 9
export const CONTRACTS_AT_SCOPED_CABANG_ONLY = 3

export const OUT_OF_SCOPE_LINE = 'Cargo Handling' as const

export interface ScopedUser {
  client: Client
  userId: string
  cleanup: () => Promise<void>
}

/**
 * A Commercial user confined to one business line, created for the duration of a test.
 *
 * No seeded account is line-scoped any more, but the policies still express the
 * boundary and it is the confidentiality guarantee this system exists to provide. So
 * the test brings its own scoped user rather than letting the property go unasserted
 * simply because the demo no longer ships an account that shows it.
 */
export const createLineScopedCommercial = async (
  // Typed from the domain rather than restated, so renaming a line in the Sheet
  // surfaces here as a type error instead of a stale literal that never matches.
  businessLine: BusinessLine,
): Promise<ScopedUser> => {
  const service = serviceClient()
  const email = `scoped-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@gapura.test`

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  })
  if (createError) throw new Error(`could not create a scoped user: ${createError.message}`)
  const userId = created.user!.id

  const { error: profileError } = await service
    .from('profiles')
    .insert({ id: userId, nama: 'Commercial (scoped)', role: 'commercial', business_line: businessLine })
  if (profileError) throw new Error(`could not profile the scoped user: ${profileError.message}`)

  const client = createClient<Database>(url(), anonKey(), anonOptions)
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  })
  if (signInError) throw new Error(`could not sign in the scoped user: ${signInError.message}`)

  return {
    client,
    userId,
    cleanup: async () => {
      await service.auth.admin.deleteUser(userId)
    },
  }
}

/** Service-role client, used only to set up and tear down fixtures. */
export const serviceClient = (): Client =>
  createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, anonOptions)
