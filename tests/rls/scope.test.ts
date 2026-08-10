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
  signInAs,
  type Client,
  type ScopedUser,
} from './client.ts'

const TOTAL_CONTRACTS = 20
/** Cargo & Warehouse is 7 of the 20 contracts in the source workbook. */
const CARGO_CONTRACTS = 7

describe('both seeded roles see the whole portfolio', () => {
  it.each([
    { persona: 'a VP', account: ACCOUNTS.vp },
    { persona: 'a Commercial user', account: ACCOUNTS.commercial },
  ])('$persona reads all 20 contracts across all three business lines', async ({ account }) => {
    const client = await signInAs(account.email)
    const { data, error } = await client.from('contracts').select('id, business_line')

    expect(error).toBeNull()
    expect(data).toHaveLength(TOTAL_CONTRACTS)
    expect(new Set(data!.map((row) => row.business_line))).toEqual(
      new Set(['Ground Handling', 'Cargo & Warehouse', 'Ancillary Business']),
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

    expect(customers.data).toHaveLength(CARGO_CONTRACTS)
    expect(cases.data!.every((row) => row.customer_id.startsWith('CUST-CG-'))).toBe(true)
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
    const { data, error } = await client.from('customers').select('customer_id')

    expect(error).toBeNull()
    expect(data).toHaveLength(TOTAL_CONTRACTS)
  })

  it('a VP sees all 20 customers and all 10 service cases', async () => {
    const client = await signInAs(ACCOUNTS.vp.email)
    const [customers, cases] = await Promise.all([
      client.from('customers').select('customer_id'),
      client.from('cases').select('id'),
    ])

    expect(customers.data).toHaveLength(TOTAL_CONTRACTS)
    expect(cases.data).toHaveLength(10)
  })

  it('a Commercial user sees every service case, across all three lines', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data, error } = await client.from('cases').select('customer_id')

    expect(error).toBeNull()
    expect(data).toHaveLength(10)
  })
})

describe('who may write', () => {
  it('a Commercial user may update any contract', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data: target } = await client.from('contracts').select('id, service_type').limit(1)
    const contract = target![0]!

    const { data, error } = await client
      .from('contracts')
      .update({ service_type: contract.service_type })
      .eq('id', contract.id)
      .select('id')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  /*
   * Deliberately absent here: "a Commercial write aimed at another business line
   * changes nothing", and "a Commercial user cannot move a contract into another
   * line". Neither holds for an all-lines Commercial user, which is the point of the
   * role now. Both properties are asserted above against a line-scoped user, where
   * they still hold and where they still matter.
   */

  it('a VP cannot write to contracts at all', async () => {
    const vp = await signInAs(ACCOUNTS.vp.email)
    const { data: target } = await vp.from('contracts').select('id, tarif').limit(1)
    const contract = target![0]!

    const { data, error } = await vp
      .from('contracts')
      .update({ tarif: 1 })
      .eq('id', contract.id)
      .select('id')

    expect(error).toBeNull()
    expect(data).toEqual([])

    const { data: after } = await vp.from('contracts').select('tarif').eq('id', contract.id).single()
    expect(Number(after!.tarif)).toBe(Number(contract.tarif))
  })

  it('nobody may write to service cases: CS_Data is read-only reference data', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data: existing } = await client.from('cases').select('id').limit(1)

    // The generated types expose an insert and update path for every table, because
    // they describe the schema and know nothing about policies. Refusing these is the
    // database's job, and that is what is being asserted.
    const { error } = await client
      .from('cases')
      .insert({ customer_id: 'CUST-GH-001', description: 'x', status: 'OPEN' })
    expect(error).not.toBeNull()

    const { data: updated } = await client
      .from('cases')
      .update({ status: 'CLOSED' })
      .eq('id', existing![0]!.id)
      .select('id')
    expect(updated ?? []).toEqual([])
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
