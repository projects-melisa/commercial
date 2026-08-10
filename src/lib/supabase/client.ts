import { createBrowserClient } from '@supabase/ssr'
import { supabasePublicKey, supabaseUrl } from '@/lib/supabase/keys'

import type { Database } from '@/lib/supabase/types'

/** Supabase client for Client Components. Used for sign-in and realtime only. */
export const createClient = () =>
  createBrowserClient<Database>(
    supabaseUrl(),
    supabasePublicKey(),
  )
