import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is not set. Start the local stack with \`pnpm db:start\`.`)
  }
}
