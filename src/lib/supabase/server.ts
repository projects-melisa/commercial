import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/keys'

import type { Database } from '@/lib/supabase/types'

/**
 * Supabase client for Server Components and Server Actions.
 *
 * Every query made through this client carries the caller's session, so the row-level
 * security policies decide what comes back. Nothing here filters by business line:
 * that is the database's job, and doing it twice would hide policy mistakes.
 */
export const createClient = async () => {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    supabaseUrl(),
    supabasePublicKey(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  )
}
