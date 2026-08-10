/**
 * Seam 2 — row-level security at the database.
 *
 * The deliberate exception to this project's single-seam preference. From the browser
 * a row hidden by an RLS policy and a row dropped by a mistaken query filter look
 * identical, and that distinction is the confidentiality guarantee the system exists
 * to provide. So these tests authenticate as each seeded user and assert the exact
 * row set that comes back.
 */
import { beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, anonClient, signInAs, type Client } from './client.ts'

const EXPECTED_SCOPE = [
  { persona: 'Ground Handling', account: ACCOUNTS.groundHandling, contracts: 8 },
  { persona: 'Cargo & Warehouse', account: ACCOUNTS.cargo, contracts: 7 },
  { persona: 'Ancillary Business', account: ACCOUNTS.ancillary, contracts: 5 },
] as const

describe('contract visibility by business line', () => {
  it.each(EXPECTED_SCOPE)(
    'a Commercial user in $persona reads exactly $contracts contracts, all their own line',
    async ({ account, contracts }) => {
      const client = await signInAs(account.email)
      const { data, error } = await client.from('contracts').select('id, business_line')

      expect(error).toBeNull()
      expect(data).toHaveLength(contracts)
      // Not just the right count: every row must belong to their line.
      expect(new Set(data!.map((row) => row.business_line))).toEqual(
        new Set([account.businessLine]),
      )
    },
  )

  it('a VP reads all 20 contracts across all three business lines', async () => {
    const client = await signInAs(ACCOUNTS.vp.email)
    const { data, error } = await client.from('contracts').select('id, business_line')

    expect(error).toBeNull()
    expect(data).toHaveLength(20)
    expect(new Set(data!.map((row) => row.business_line))).toEqual(
      new Set(['Ground Handling', 'Cargo & Warehouse', 'Ancillary Business']),
    )
  })

  it('a Commercial user cannot reach another line even by asking for it directly', async () => {
    const client = await signInAs(ACCOUNTS.cargo.email)
    const { data, error } = await client
      .from('contracts')
      .select('id')
      .eq('business_line', 'Ground Handling')

    // The rows are not visible to the session, so the filter matches nothing rather
    // than being refused. Silence, not an error, is the correct answer.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describe('customers and cases follow their contract', () => {
  it.each(EXPECTED_SCOPE)(
    '$persona sees only the customers whose contract is in their line',
    async ({ account, contracts }) => {
      const client = await signInAs(account.email)
      const { data, error } = await client.from('customers').select('customer_id')

      expect(error).toBeNull()
      expect(data).toHaveLength(contracts)
    },
  )

  it('a VP sees all 20 customers and all 10 service cases', async () => {
    const client = await signInAs(ACCOUNTS.vp.email)
    const [customers, cases] = await Promise.all([
      client.from('customers').select('customer_id'),
      client.from('cases').select('id'),
    ])

    expect(customers.data).toHaveLength(20)
    expect(cases.data).toHaveLength(10)
  })

  it('a Commercial user sees only the cases logged against their own customers', async () => {
    const client = await signInAs(ACCOUNTS.cargo.email)
    const { data, error } = await client.from('cases').select('customer_id')

    expect(error).toBeNull()
    // CS_Data logs 3 cases against Cargo & Warehouse customers.
    expect(data!.length).toBeGreaterThan(0)
    expect(data!.every((row) => row.customer_id.startsWith('CUST-CG-'))).toBe(true)
  })
})

describe('writes are confined to the caller´s own scope', () => {
  it('a Commercial user may update a contract in their own line', async () => {
    const client = await signInAs(ACCOUNTS.groundHandling.email)
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

  it('a Commercial write aimed at another business line changes nothing', async () => {
    const cargo = await signInAs(ACCOUNTS.cargo.email)
    const vp = await signInAs(ACCOUNTS.vp.email)

    const { data: outOfScope } = await vp
      .from('contracts')
      .select('id, tarif')
      .eq('business_line', 'Ground Handling')
      .limit(1)
    const target = outOfScope![0]!

    const { data, error } = await cargo
      .from('contracts')
      .update({ tarif: 1 })
      .eq('id', target.id)
      .select('id')

    expect(error).toBeNull()
    expect(data).toEqual([])

    // And the row is genuinely untouched, not merely unreported.
    const { data: after } = await vp.from('contracts').select('tarif').eq('id', target.id).single()
    expect(Number(after!.tarif)).toBe(Number(target.tarif))
  })

  it('a Commercial user cannot move a contract into another business line', async () => {
    const client = await signInAs(ACCOUNTS.groundHandling.email)
    const { data: target } = await client.from('contracts').select('id').limit(1)

    const { data, error } = await client
      .from('contracts')
      .update({ business_line: 'Cargo & Warehouse' })
      .eq('id', target![0]!.id)
      .select('id')

    // The with-check clause refuses the new row even though the old one was visible.
    expect(data ?? []).toEqual([])
    if (error) expect(error.message).toMatch(/row-level security/i)
  })

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
    const client = await signInAs(ACCOUNTS.groundHandling.email)
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

describe('the seeded scopes are meaningfully partitioned', () => {
  let vp: Client

  beforeAll(async () => {
    vp = await signInAs(ACCOUNTS.vp.email)
  })

  it('the largest Commercial scope still hides most of the portfolio', async () => {
    const { data: all } = await vp.from('contracts').select('id')
    const largest = await signInAs(ACCOUNTS.groundHandling.email)
    const { data: scoped } = await largest.from('contracts').select('id')

    expect(scoped!.length / all!.length).toBeLessThan(0.5)
  })

  it('the three Commercial scopes are disjoint and together cover the portfolio', async () => {
    const scopes = await Promise.all(
      EXPECTED_SCOPE.map(async ({ account }) => {
        const client = await signInAs(account.email)
        const { data } = await client.from('contracts').select('id')
        return data!.map((row) => row.id)
      }),
    )

    const combined = scopes.flat()
    expect(new Set(combined).size).toBe(combined.length)
    expect(combined).toHaveLength(20)
  })
})
