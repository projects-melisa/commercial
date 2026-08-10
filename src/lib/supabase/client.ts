import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/supabase/types'

/** Supabase client for Client Components. Used for sign-in and realtime only. */
export const createClient = () =>
  createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
