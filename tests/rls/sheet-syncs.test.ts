/**
 * Seam 2 — the sheet-sync log.
 *
 * The mirror exists so spreadsheet work keeps functioning; the log exists so a mirror
 * that has quietly stopped refreshing is visible rather than silently stale. That only
 * holds if every user can read the log and nobody can write to it: a run record a user
 * could forge would report health that never happened.
 *
 * The log carries timestamps and counts, never tarif or cost, so unlike almost
 * everything else here it is deliberately not scoped by business line.
 */
import { describe, expect, it } from 'vitest'

import { ACCOUNTS, anonClient, serviceClient, signInAs } from './client.ts'

const EVERY_PERSONA = [
  { persona: 'a VP', account: ACCOUNTS.vp },
  { persona: 'a Commercial user', account: ACCOUNTS.commercial },
] as const

describe('the sheet-sync log is readable by everyone and writable by nobody', () => {
  it.each(EVERY_PERSONA)('$persona can read the log', async ({ account }) => {
    const client = await signInAs(account.email)
    const { error } = await client.from('sheet_syncs').select('id, status, finished_at')

    // Staleness has to be visible to the people who depend on the mirror, and the log
    // holds no commercial terms, so this read is deliberately unscoped.
    expect(error).toBeNull()
  })

  it.each(EVERY_PERSONA)('$persona cannot record a run that never happened', async ({ account }) => {
    const client = await signInAs(account.email)
    const { data, error } = await client
      .from('sheet_syncs')
      .insert({ status: 'ok', trigger: 'schedule', rows_written: 20 })
      .select('id')

    expect(data ?? []).toEqual([])
    expect(error).not.toBeNull()
  })

  it('nobody can rewrite a recorded run', async () => {
    const service = serviceClient()
    const { data: recorded, error: insertError } = await service
      .from('sheet_syncs')
      .insert({ status: 'failed', trigger: 'schedule', rows_written: 0, error: 'fixture' })
      .select('id')
      .single()
    expect(insertError).toBeNull()

    const vp = await signInAs(ACCOUNTS.vp.email)
    const { data: updated } = await vp
      .from('sheet_syncs')
      .update({ status: 'ok' })
      .eq('id', recorded!.id)
      .select('id')
    expect(updated ?? []).toEqual([])

    const { data: deleted } = await vp
      .from('sheet_syncs')
      .delete()
      .eq('id', recorded!.id)
      .select('id')
    expect(deleted ?? []).toEqual([])

    // Still there, still failed: the record of what happened is not editable.
    const { data: after } = await service
      .from('sheet_syncs')
      .select('status')
      .eq('id', recorded!.id)
      .single()
    expect(after!.status).toBe('failed')

    await service.from('sheet_syncs').delete().eq('id', recorded!.id)
  })

  it('an unauthenticated caller reads nothing from it', async () => {
    const { data, error } = await anonClient().from('sheet_syncs').select('*')

    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describe('a failed run cannot be recorded as a success', () => {
  it('a failure must carry its error, and a success must not invent one', async () => {
    const service = serviceClient()

    const failureWithoutReason = await service
      .from('sheet_syncs')
      .insert({ status: 'failed', trigger: 'schedule', rows_written: 0 })
      .select('id')
    expect(failureWithoutReason.error).not.toBeNull()

    const successWithReason = await service
      .from('sheet_syncs')
      .insert({ status: 'ok', trigger: 'schedule', rows_written: 20, error: 'but it worked?' })
      .select('id')
    expect(successWithReason.error).not.toBeNull()
  })
})
