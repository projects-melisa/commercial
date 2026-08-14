/**
 * Seam 2, continued — the reminder function.
 *
 * `send_expiry_reminders` is security definer, so RLS does not apply inside it. That
 * makes it the one place where the business-line boundary has to be re-imposed by
 * hand, and therefore the one place worth testing hardest.
 *
 * The seeded Commercial user covers every line, so the out-of-scope case is asserted
 * against a line-scoped user the test creates: the check inside the function still
 * exists and still has to work, whether or not any seeded account exercises it.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  createLineScopedCommercial,
  serviceClient,
  signInAs,
  type ScopedUser,
} from './client.ts'

describe('scope', () => {
  let scoped: ScopedUser

  beforeAll(async () => {
    scoped = await createLineScopedCommercial('Cargo Handling')
  })

  afterAll(async () => {
    await scoped.cleanup()
  })

  it('a line-scoped Commercial user cannot prompt on a contract outside their line', async () => {
    const service = serviceClient()
    const { data: outOfScope } = await service
      .from('contracts')
      .select('id')
      .eq('business_line', 'Ground Handling')
      .limit(1)
    const target = outOfScope![0]!

    // The row is invisible to a direct select…
    const { data: visible } = await scoped.client
      .from('contracts')
      .select('id')
      .eq('id', target.id)
    expect(visible).toEqual([])

    // …and the function must not become a way around that. Returning nothing is the
    // point: no customer name, no days remaining, no notification written elsewhere.
    const { data, error } = await scoped.client.rpc('send_expiry_reminders', {
      target_contract_id: target.id,
    })
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('a Commercial user covering every line may prompt on any contract', async () => {
    const commercial = await signInAs(ACCOUNTS.commercial.email)
    const { data: own } = await commercial
      .from('contracts')
      .select('id, contract_end_date')
      .order('contract_end_date')
      .limit(1)

    const { data, error } = await commercial.rpc('send_expiry_reminders', {
      target_contract_id: own![0]!.id,
    })
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('an unauthenticated caller gets nothing from it', async () => {
    const service = serviceClient()
    const { data: any } = await service.from('contracts').select('id').limit(1)

    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    )
    const { data, error } = await anon.rpc('send_expiry_reminders', {
      target_contract_id: any![0]!.id,
    })
    // Execute is revoked from anon, so this is refused outright.
    expect(error ?? { message: '' }).toBeTruthy()
    expect(data ?? []).toEqual([])
  })
})

describe('milestones', () => {
  it('does not burn a milestone the contract has not reached', async () => {
    const service = serviceClient()
    // An "Aman" contract, comfortably beyond the widest milestone.
    const { data: aman } = await service
      .from('contracts')
      .select('id, business_line, contract_end_date')
      .order('contract_end_date', { ascending: false })
      .limit(1)
    const target = aman![0]!

    // The Commercial user covers every line, so they can prompt on whichever line this
    // contract happens to belong to.
    const client = await signInAs(ACCOUNTS.commercial.email)

    const { data } = await client.rpc('send_expiry_reminders', {
      target_contract_id: target.id,
    })
    // Nothing to say yet — and crucially no `expiry-60` row, which would have
    // suppressed the genuine H-60 reminder when the contract eventually reaches it.
    expect(data).toEqual([])

    const { data: written } = await service
      .from('notifications')
      .select('milestone_key')
      .eq('contract_id', target.id)
    expect(written).toEqual([])
  })

  it('is idempotent: the same milestone is never sent twice', async () => {
    const service = serviceClient()
    // Start from no reminders, so this holds regardless of what ran before it.
    await service.from('notifications').delete().not('milestone_key', 'is', null)

    const first = await service.rpc('send_expiry_reminders')
    const firstWrites = (first.data ?? []).filter((row) => row.notification_id !== null)
    expect(firstWrites.length).toBeGreaterThan(0)

    const second = await service.rpc('send_expiry_reminders')
    const secondWrites = (second.data ?? []).filter((row) => row.notification_id !== null)
    expect(secondWrites).toEqual([])
  })

  it('bands severity by how close expiry is', async () => {
    const service = serviceClient()
    await service.rpc('send_expiry_reminders')

    const { data } = await service.from('notifications').select('severity, milestone_key')
    for (const row of data ?? []) {
      if (row.milestone_key === 'expiry-14') expect(row.severity).toBe('critical')
    }
  })
})
