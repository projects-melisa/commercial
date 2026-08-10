import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

import { config } from 'dotenv'

config({ path: '.env.local', quiet: true })

const FUNCTION_ENV_PATH = 'supabase/functions/.env.local'

/**
 * The Edge Function's local settings, pointed at the stack's own Mailpit.
 *
 * Written rather than committed, because the file is a `.env` and committing one
 * teaches the wrong habit even when it holds nothing secret. Nothing here leaves the
 * machine: Mailpit accepts every message and delivers none.
 */
const writeFunctionEnv = (): void => {
  if (existsSync(FUNCTION_ENV_PATH)) return
  writeFileSync(
    FUNCTION_ENV_PATH,
    [
      '# Generated for local runs. Mailpit inbox: http://127.0.0.1:54324',
      'SMTP_HOST=host.docker.internal',
      'SMTP_PORT=54325',
      'SMTP_TLS=false',
      'SMTP_FROM=G-CME <no-reply@gapura.local>',
      'REMINDER_RECIPIENT_OVERRIDE=demo-inbox@gapura.local',
      '',
    ].join('\n'),
  )
}

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
/**
 * Whether the configured Supabase is the CLI's local stack.
 *
 * The suite starts by wiping the database and then writes to it throughout, which is
 * fine against a disposable local stack and destructive against anything else.
 */
const isLocalStack = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?/.test(url)
}

export default async function globalSetup(): Promise<void> {
  if (!isLocalStack() && process.env.E2E_ALLOW_REMOTE_RESET !== 'true') {
    throw new Error(
      [
        `NEXT_PUBLIC_SUPABASE_URL points at ${process.env.NEXT_PUBLIC_SUPABASE_URL}, which is not`,
        'the local stack. This suite resets the database before it runs and files scenarios',
        'and contract edits while it runs, so pointing it at a hosted project would destroy',
        'the seeded demo data.',
        '',
        'Run the tests against the local stack, or set E2E_ALLOW_REMOTE_RESET=true if you',
        'genuinely mean to wipe the project this URL refers to.',
      ].join('\n'),
    )
  }

  writeFunctionEnv()

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
