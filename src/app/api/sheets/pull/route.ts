import { NextResponse, type NextRequest } from 'next/server'

import { pullFromSheets, recordRun } from '@/lib/sheets/pull'

/**
 * Pulls the Google Sheet into Supabase.
 *
 * Invoked daily by a pg_cron job inside Supabase (`invoke_sheets_pull`), which is an
 * external trigger and therefore one of the few things here that needs an HTTP
 * endpoint rather than a Server Action.
 *
 * Guarded by a shared secret rather than a user session: the caller is a database
 * job, not a person. The secret is compared in constant time so the endpoint cannot
 * be used as an oracle to recover it a byte at a time.
 *
 * Replaces `/api/sheets/sync`, which wrote the other way. Deleted rather than left
 * disabled: the Sheet is the source of truth, and an endpoint that can overwrite it
 * is a loaded gun regardless of whether anything is scheduled to pull the trigger.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// The ancillary tab is 8k+ rows across chunked POSTs plus five Sheet reads; the
// platform default of 10s (hobby) / 60s would kill a healthy run mid-write.
export const maxDuration = 300

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const expected = process.env.SHEETS_SYNC_SECRET
  if (!expected) {
    // Refuse rather than run unauthenticated: an unset secret must not mean "open".
    return NextResponse.json({ error: 'SHEETS_SYNC_SECRET is not configured' }, { status: 503 })
  }

  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!timingSafeEqual(supplied, expected)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as { trigger?: string }
  const trigger = body.trigger === 'schedule' ? 'schedule' : 'manual'
  const startedAt = new Date().toISOString()

  const tabs = await pullFromSheets(startedAt)
  await recordRun(tabs, trigger, startedAt)

  // A tab that failed is a partial run, not a dead one: the tabs that succeeded have
  // already been written. 207 says so honestly, where 200 and 500 both lie.
  const failed = tabs.filter((result) => result.error !== null)
  if (failed.length > 0) console.error('[sheets/pull]', failed)

  return NextResponse.json(
    { status: failed.length === 0 ? 'ok' : 'partial', trigger, tabs },
    { status: failed.length === 0 ? 200 : 207 },
  )
}
