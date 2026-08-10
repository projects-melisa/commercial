import { execFileSync } from 'node:child_process'

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const SEEDED_CONTRACT_COUNT = 20

const contractCount = async (): Promise<number | null> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/contracts?select=id`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          Prefer: 'count=exact',
        },
      },
    )
    if (!response.ok) return null
    return ((await response.json()) as unknown[]).length
  } catch {
    return null
  }
}

/**
 * Resets the database to the seeded state before the suite runs.
 *
 * These specs edit contracts and file scenarios, so without this the second run would
 * start from the first run's leftovers and the row-count assertions would drift.
 *
 * The CLI's exit code is deliberately ignored. `db reset` restarts the stack's
 * containers as its last step, and the gateway routinely answers 502 while they come
 * back up — the reset itself having already succeeded. What the suite actually needs
 * is a reachable API serving the seeded rows, so that is what gets checked.
 */
export default async function globalSetup(): Promise<void> {
  try {
    execFileSync('supabase', ['db', 'reset'], { stdio: 'inherit' })
  } catch {
    console.warn('supabase db reset exited non-zero; verifying the database directly…')
  }

  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const count = await contractCount()
    if (count === SEEDED_CONTRACT_COUNT) return
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  throw new Error(
    `database did not come back with ${SEEDED_CONTRACT_COUNT} seeded contracts; ` +
      'is the local stack running (`pnpm db:start`)?',
  )
}
