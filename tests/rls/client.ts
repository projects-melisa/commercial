import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../src/lib/demo-accounts.ts'
import type { Database } from '../../src/lib/supabase/database.types.ts'

export type Client = SupabaseClient<Database>

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const anonOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const

/** A client carrying no session at all — the unauthenticated caller. */
export const anonClient = (): Client => createClient<Database>(url(), anonKey(), anonOptions)

/**
 * A client authenticated as one of the seeded users, using the anon key exactly as
 * the browser does. Nothing here elevates privileges, so what these tests see is
 * what that person's session sees.
 */
export const signInAs = async (email: string): Promise<Client> => {
  const client = createClient<Database>(url(), anonKey(), anonOptions)
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`)
  return client
}

export const ACCOUNTS = {
  vp: DEMO_ACCOUNTS.find((a) => a.role === 'vp')!,
  groundHandling: DEMO_ACCOUNTS.find((a) => a.businessLine === 'Ground Handling')!,
  cargo: DEMO_ACCOUNTS.find((a) => a.businessLine === 'Cargo & Warehouse')!,
  ancillary: DEMO_ACCOUNTS.find((a) => a.businessLine === 'Ancillary Business')!,
}

/** Service-role client, used only to set up and tear down fixtures. */
export const serviceClient = (): Client =>
  createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, anonOptions)
