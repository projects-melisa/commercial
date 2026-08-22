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
 * One seeded login per role, all nine.
 *
 * Keyed off `role` rather than off an email literal, so a renamed demo account breaks
 * here as a missing key instead of quietly signing the whole suite in as nobody.
 */
const account = (role: (typeof DEMO_ACCOUNTS)[number]['role']) => {
  const found = DEMO_ACCOUNTS.find((a) => a.role === role)
  if (!found) throw new Error(`no seeded demo account for role ${role}`)
  return found
}

export const ACCOUNTS = {
  vp: account('vp'),
  commercial: account('commercial_kps'),
  dirut: account('direktur_utama'),
  cabang: account('cabang'),
  finance: account('finance_kps'),
  op: account('op_kps'),
  os: account('os_kps'),
  ocs: account('ocs_kps'),
  superAdmin: account('super_admin'),
}

/**
 * The seeded GM Cabang's station.
 *
 * They no longer hold any contract grant at all — the station boundary they show is on
 * `ancillary_revenues`, the one new table that carries a real `cab` column. The
 * contract counts this file used to export went with the grant.
 */
export const SCOPED_CABANG = 'CGK' as const

export const OUT_OF_SCOPE_LINE = 'Cargo Handling' as const

export interface ScopedUser {
  client: Client
  userId: string
  cleanup: () => Promise<void>
}

/**
 * A Commercial user confined to one business line.
 *
 * This used to mint a fresh user per run through the Admin API; the local GoTrue now
 * refuses the legacy HS256 service token, so the scoped account is seeded by migration
 * instead (`20260822150700_line_scoped_demo_account.sql`) and signed into like any
 * other persona. Nothing to clean up: it is part of the book.
 *
 * The line is still the confidentiality guarantee this system exists to provide, and
 * Cargo Handling is the line every unscoped account does NOT already cover.
 */
export const LINE_SCOPED_EMAIL = 'cargo@gapura.test'

export const createLineScopedCommercial = async (
  // Kept for call-site honesty: passing anything but Cargo Handling is a test bug,
  // because that is the only line the seeded account holds.
  businessLine: BusinessLine,
): Promise<ScopedUser> => {
  if (businessLine !== OUT_OF_SCOPE_LINE) {
    throw new Error(`the seeded line-scoped account only covers ${OUT_OF_SCOPE_LINE}`)
  }

  const client = await signInAs(LINE_SCOPED_EMAIL)
  const { data } = await serviceClient()
    .from('profiles')
    .select('id')
    .eq('business_line', businessLine)
    .single()

  return { client, userId: data!.id, cleanup: async () => {} }
}

/** Service-role client, used only to set up and tear down fixtures. */
export const serviceClient = (): Client =>
  createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, anonOptions)
