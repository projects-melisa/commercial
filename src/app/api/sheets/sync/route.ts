import { NextResponse, type NextRequest } from 'next/server'

import { recordRun, syncToSheets } from '@/lib/sheets/sync'

/**
 * Refreshes the Google Sheets mirror.
 *
 * Invoked daily by a pg_cron job inside Supabase (`invoke_sheets_sync`), which is an
 * external trigger and therefore one of the few things here that needs an HTTP
 * endpoint rather than a Server Action.
 *
 * Guarded by a shared secret rather than a user session: the caller is a database
 * job, not a person. The secret is compared in constant time so the endpoint cannot
 * be used as an oracle to recover it a byte at a time.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  try {
    const result = await syncToSheets()
    await recordRun({ status: 'ok', rowsWritten: result.rowsWritten }, trigger, startedAt)
    return NextResponse.json({ status: 'ok', trigger, ...result })
  } catch (error) {
    const message = (error as Error).message
    // Record the failure before returning, so the log distinguishes "the sync broke"
    // from "the sync has not run since Tuesday".
    await recordRun({ status: 'failed', error: message }, trigger, startedAt)
    console.error('[sheets/sync]', error)
    return NextResponse.json({ status: 'failed', error: message }, { status: 500 })
  }
}
