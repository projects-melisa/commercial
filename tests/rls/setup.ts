import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Start the local stack with `pnpm db:start`.')
}
if (
  !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
) {
  throw new Error(
    'Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).',
  )
}
