/**
 * Seam 2 — row-level security at the database.
 *
 * The deliberate exception to this project's single-seam preference. From the browser
 * a row hidden by an RLS policy and a row dropped by a mistaken query filter look
 * identical, and that distinction is the confidentiality guarantee the system exists
 * to provide. So these tests authenticate as each seeded user and assert the exact
 * row set that comes back.
 *
 * There are two seeded logins, one per role. The Commercial account holds Ground
 * Handling; the other two lines have no user at all, which is what makes them useful
 * here — rows that belong to nobody signed in are the sharpest test of whether the
 * policy, rather than a query filter, is doing the hiding.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  anonClient,
  createLineScopedCommercial,
  OUT_OF_SCOPE_LINE,
  serviceClient,
  signInAs,
  type Client,
  type ScopedUser,
} from './client.ts'

/**
 * Counts come from the Google Sheet, which is the source of truth — so the ones that
 * move whenever the workbook is re-seeded are read from the database at runtime rather
 * than hardcoded to the day this file was written. The seed mirrors the live Sheet,
 * and the live Sheet has grown since (33 customers today).
 */
const TOTAL_CONTRACTS = 15
const countInBook = async (
  table: 'customers' | 'cases',
): Promise<number> => {
  const { count } = await serviceClient()
    .from(table)
    .select('*', { count: 'exact', head: true })
  return count ?? 0
}
/** Cargo Handling is 7 of the 20 contracts in the source workbook. */
/** Cargo Handling is 2 of the 15 lines — K-009 at CGK and at SUB — both CUST-001's. */
const CARGO_CONTRACTS = 2
const CARGO_CUSTOMERS = 1

describe('both seeded roles see the whole portfolio', () => {
  it.each([
    { persona: 'a VP', account: ACCOUNTS.vp },
    { persona: 'a Commercial user', account: ACCOUNTS.commercial },
  ])('$persona reads every contract line, across all three business lines', async ({ account }) => {
    const client = await signInAs(account.email)
    const { data, error } = await client.from('contracts').select('id, business_line')

    expect(error).toBeNull()
    expect(data).toHaveLength(TOTAL_CONTRACTS)
    expect(new Set(data!.map((row) => row.business_line))).toEqual(
      new Set(['Ground Handling', 'Cargo Handling', 'Ancillary Business']),
    )
  })
})

/*
 * The confidentiality guarantee, asserted against a user the test creates.
 *
 * Neither seeded account is line-scoped, so nothing a judge can log into demonstrates
 * this any more. The policies still express it, and it is the property the system was
 * built to provide, so it is asserted here rather than dropped along with the accounts
 * that used to show it.
 */
describe('a line-scoped Commercial user is still confined by the policy', () => {
  let scoped: ScopedUser

  beforeAll(async () => {
    scoped = await createLineScopedCommercial(OUT_OF_SCOPE_LINE)
  })

  afterAll(async () => {
    await scoped.cleanup()
  })

  it(`reads exactly ${CARGO_CONTRACTS} contracts, all their own line`, async () => {
    const { data, error } = await scoped.client.from('contracts').select('id, business_line')

    expect(error).toBeNull()
    expect(data).toHaveLength(CARGO_CONTRACTS)
    expect(new Set(data!.map((row) => row.business_line))).toEqual(new Set([OUT_OF_SCOPE_LINE]))
  })

  it('cannot reach another line even by asking for it directly', async () => {
    const { data, error } = await scoped.client
      .from('contracts')
      .select('id')
      .eq('business_line', 'Ground Handling')

    // The rows are not visible to the session, so the filter matches nothing rather
    // than being refused. Silence, not an error, is the correct answer.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('sees only the customers and cases belonging to their own line', async () => {
    const [customers, cases] = await Promise.all([
      scoped.client.from('customers').select('customer_id'),
      scoped.client.from('cases').select('customer_id'),
    ])

    expect(customers.data).toHaveLength(CARGO_CUSTOMERS)
    // Every visible case belongs to a customer whose contract is in this line.
    const visible = new Set(customers.data!.map((row) => row.customer_id))
    expect(cases.data!.every((row) => visible.has(row.customer_id))).toBe(true)
  })

  it('cannot write to a contract outside their line', async () => {
    const vp = await signInAs(ACCOUNTS.vp.email)
    const { data: outOfScope } = await vp
      .from('contracts')
      .select('id, tarif')
      .eq('business_line', 'Ground Handling')
      .limit(1)
    const target = outOfScope![0]!

    const { data } = await scoped.client
      .from('contracts')
      .update({ tarif: 1 })
      .eq('id', target.id)
      .select('id')
    expect(data ?? []).toEqual([])

    const { data: after } = await vp.from('contracts').select('tarif').eq('id', target.id).single()
    expect(Number(after!.tarif)).toBe(Number(target.tarif))
  })
})

describe('customers and cases follow their contract', () => {
  it('the Commercial user sees every customer, matching their contract scope', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const [book, seen] = await Promise.all([
      countInBook('customers'),
      client.from('customers').select('customer_id'),
    ])

    expect(seen.error).toBeNull()
    expect(seen.data).toHaveLength(book)
  })

  it('a VP sees every customer, and no service case at all', async () => {
    const client = await signInAs(ACCOUNTS.vp.email)
    const [book, customers, cases] = await Promise.all([
      countInBook('customers'),
      client.from('customers').select('customer_id'),
      client.from('cases').select('id'),
    ])

    expect(customers.data).toHaveLength(book)
    // Irregularities became OCS-only. This is the deliberate cost recorded as R-01:
    // the renewal decision can no longer see "this customer has two open cases".
    expect(cases.data).toEqual([])
  })

  it('a Commercial user sees no service case either', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data, error } = await client.from('cases').select('customer_id')

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('OCS is the one role that sees them, and sees every case there is', async () => {
    const client = await signInAs(ACCOUNTS.ocs.email)
    const [book, seen] = await Promise.all([
      countInBook('cases'),
      client.from('cases').select('id'),
    ])

    expect(seen.error).toBeNull()
    expect(seen.data).toHaveLength(book)
  })
})

describe('nobody writes contracts, customers or cases from the web', () => {
  /*
   * The Sheet is the source of truth, so the web is a mirror and not a keyboard. The
   * predicate this replaced was `caller_may_write()` — literally "not the VP" — which
   * was correct while there were three roles and silently handed write access to six
   * more the moment the enum grew. Every role is asserted, not a representative one,
   * because "representative" is exactly the assumption that failed last time.
   */
  const EVERYONE = [
    ['VP', ACCOUNTS.vp],
    ['Commercial', ACCOUNTS.commercial],
    ['Direktur Utama', ACCOUNTS.dirut],
    ['Finance', ACCOUNTS.finance],
    ['OP', ACCOUNTS.op],
    ['OS', ACCOUNTS.os],
    ['OCS', ACCOUNTS.ocs],
    ['Super Admin', ACCOUNTS.superAdmin],
  ] as const

  it.each(EVERYONE)('%s cannot insert a contract', async (_label, account) => {
    const client = await signInAs(account.email)
    const { error } = await client.from('contracts').insert({
      customer_id: 'CUST-001',
      business_line: 'Ground Handling',
      contract_end_date: '2027-01-01',
      tarif: 1000,
      cost: 500,
    })

    expect(error).not.toBeNull()
  })

  it.each(EVERYONE)('%s cannot insert a customer', async (_label, account) => {
    const client = await signInAs(account.email)
    const { error } = await client
      .from('customers')
      .insert({ customer_id: 'CUST-901', nama: 'Uji Tulis', rfm_status: 'LOW' })

    expect(error).not.toBeNull()
  })

  it('but may mark one followed up — the one column the Sheet does not own', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data: target } = await client.from('contracts').select('id').limit(1)
    const id = target![0]!.id

    const stamp = new Date().toISOString()
    const { data: updated, error } = await client
      .from('contracts')
      .update({ followed_up_at: stamp })
      .eq('id', id)
      .select('id')

    expect(error).toBeNull()
    expect(updated).toHaveLength(1)

    await serviceClient().from('contracts').update({ followed_up_at: null }).eq('id', id)
  })

  it('and the column grant is what stops that becoming contract editing', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data: target } = await client.from('contracts').select('id, tarif').limit(1)
    const contract = target![0]!

    // Same policy, different column. RLS cannot restrict columns, so the guard is
    // `grant update (followed_up_at)` — without it the follow-up policy would have
    // handed back the ability to rewrite tarif and cost.
    const { error } = await client
      .from('contracts')
      .update({ tarif: 1 })
      .eq('id', contract.id)
      .select('id')

    expect(error).not.toBeNull()
    const { data: after } = await client
      .from('contracts')
      .select('tarif')
      .eq('id', contract.id)
      .single()
    expect(Number(after!.tarif)).toBe(Number(contract.tarif))
  })

})

describe('irregularities are OCS-only, to write as well as to read', () => {
  it('OCS may log a case and close it', async () => {
    const client = await signInAs(ACCOUNTS.ocs.email)

    const { data: logged, error } = await client
      .from('cases')
      .insert({ customer_id: 'CUST-001', description: 'Uji pencatatan kasus OCS', status: 'OPEN' })
      .select('id')
      .single()
    expect(error).toBeNull()

    const { data: closed } = await client
      .from('cases')
      .update({ status: 'CLOSED' })
      .eq('id', logged!.id)
      .select('status')
    expect(closed![0]!.status).toBe('CLOSED')

    // No delete policy: a case that happened happened.
    const { data: deleted } = await client.from('cases').delete().eq('id', logged!.id).select('id')
    expect(deleted ?? []).toEqual([])

    await serviceClient().from('cases').delete().eq('id', logged!.id)
  })

  it.each([
    ['Commercial', ACCOUNTS.commercial],
    ['VP', ACCOUNTS.vp],
    ['Finance', ACCOUNTS.finance],
    ['OP', ACCOUNTS.op],
  ] as const)('%s cannot log one', async (_label, account) => {
    const client = await signInAs(account.email)
    const { error } = await client
      .from('cases')
      .insert({ customer_id: 'CUST-001', description: 'x', status: 'OPEN' })

    expect(error).not.toBeNull()
  })
})

describe('an unauthenticated caller reads nothing from any table', () => {
  const TABLES = ['profiles', 'customers', 'contracts', 'cases', 'scenarios', 'notifications'] as const

  it.each(TABLES)('%s returns no rows without a session', async (table) => {
    const client: Client = anonClient()
    const { data, error } = await client.from(table).select('*')

    // No policy grants the anon role anything, so the result is empty rather than an
    // error — the rows simply do not exist for that session.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
