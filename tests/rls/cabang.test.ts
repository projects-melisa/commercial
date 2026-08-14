/**
 * Seam 2 — the station boundary.
 *
 * A GM Cabang holds Commercial's authority over one airport's contracts and no
 * visibility of anyone else's. Both halves are asserted here, because either one
 * failing alone would be invisible from the browser: too much visible looks like a
 * larger portfolio, too little looks like an empty branch.
 *
 * This is the boundary a judge can log in and see, which the line-scoped case no
 * longer is — the seeded GM Cabang is confined to CGK and the other fourteen
 * contracts never reach the session.
 */
import { describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  CONTRACTS_AT_SCOPED_CABANG,
  CONTRACTS_AT_SCOPED_CABANG_ONLY,
  SCOPED_CABANG,
  signInAs,
} from './client.ts'

/**
 * A contract the GM Cabang must not be able to reach, found as someone who can.
 *
 * Deliberately not "any contract at another station": Garuda Indonesia holds lines at
 * both CGK and SUB, so picking the SUB one and then asserting its *customer* is
 * invisible would be asserting something false. The customer has to be one with no
 * line the GM can see at all — no CGK line and no "All Station" line — which makes
 * the invisibility assertions below mean what they say, whatever order the rows
 * happen to come back in.
 */
const contractElsewhere = async () => {
  const commercial = await signInAs(ACCOUNTS.commercial.email)
  const { data } = await commercial.from('contracts').select('id, tarif, cabang, customer_id')

  const reachable = new Set(
    data!.filter((c) => c.cabang === null || c.cabang === SCOPED_CABANG).map((c) => c.customer_id),
  )
  const exclusive = data!.find((c) => c.cabang !== null && !reachable.has(c.customer_id))
  if (!exclusive) {
    throw new Error(
      `no customer is confined to stations other than ${SCOPED_CABANG}; this fixture cannot assert invisibility`,
    )
  }
  return exclusive
}

describe('a GM Cabang sees their own station and nothing else', () => {
  it(`reads the ${CONTRACTS_AT_SCOPED_CABANG} contract lines that reach ${SCOPED_CABANG}`, async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data, error } = await client.from('contracts').select('id, cabang')

    expect(error).toBeNull()
    expect(data).toHaveLength(CONTRACTS_AT_SCOPED_CABANG)
    // Their own station, plus the Sheet's "All Station" work — and nothing else.
    expect(new Set(data!.map((row) => row.cabang))).toEqual(new Set([SCOPED_CABANG, null]))
  })

  it('sees "All Station" contracts, which belong to every airport', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data } = await client.from('contracts').select('id, cabang')

    const atOwnStation = data!.filter((row) => row.cabang === SCOPED_CABANG)
    const allStation = data!.filter((row) => row.cabang === null)

    expect(atOwnStation).toHaveLength(CONTRACTS_AT_SCOPED_CABANG_ONLY)
    // The point of the assertion: a null station is work at every airport, so hiding
    // it from the branch GM would be the exact inverse of what the Sheet says.
    expect(allStation.length).toBeGreaterThan(0)
  })

  it('carries no business-line confinement — every line at that station is theirs', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data } = await client.from('contracts').select('business_line')

    // The station spans all three lines in the seed, which is what makes this an
    // assertion about the station rather than an accident of a one-line branch.
    expect(new Set(data!.map((row) => row.business_line))).toEqual(
      new Set(['Ground Handling', 'Cargo Handling', 'Ancillary Business']),
    )
  })

  it('cannot read a contract at another station, even asked for by id', async () => {
    const elsewhere = await contractElsewhere()
    const client = await signInAs(ACCOUNTS.cabang.email)

    const { data, error } = await client
      .from('contracts')
      .select('id, tarif')
      .eq('id', elsewhere.id)

    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('sees no customer or case belonging only to another station', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const [customers, cases] = await Promise.all([
      client.from('customers').select('customer_id'),
      client.from('cases').select('customer_id'),
    ])

    // A customer whose only contract line sits at another station is invisible, and
    // their service cases go with them.
    const elsewhere = await contractElsewhere()
    expect(customers.data!.map((row) => row.customer_id)).not.toContain(elsewhere.customer_id)
    expect(cases.data!.map((row) => row.customer_id)).not.toContain(elsewhere.customer_id)
  })
})

describe('a GM Cabang writes exactly as Commercial does, within that station', () => {
  it('may update a contract at their own station', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data: own } = await client
      .from('contracts')
      .select('id, service_type')
      .eq('cabang', SCOPED_CABANG)
      .limit(1)
    const contract = own![0]!

    const { data, error } = await client
      .from('contracts')
      .update({ service_type: contract.service_type })
      .eq('id', contract.id)
      .select('id')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('changes nothing when writing to a contract at another station', async () => {
    const elsewhere = await contractElsewhere()
    const client = await signInAs(ACCOUNTS.cabang.email)

    const { data, error } = await client
      .from('contracts')
      .update({ tarif: 1 })
      .eq('id', elsewhere.id)
      .select('id')

    expect(error).toBeNull()
    expect(data ?? []).toEqual([])

    const commercial = await signInAs(ACCOUNTS.commercial.email)
    const { data: after } = await commercial
      .from('contracts')
      .select('tarif')
      .eq('id', elsewhere.id)
      .single()
    expect(Number(after!.tarif)).toBe(Number(elsewhere.tarif))
  })

  it('cannot move one of their own contracts to another station', async () => {
    const elsewhere = await contractElsewhere()
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data: own } = await client
      .from('contracts')
      .select('id')
      .eq('cabang', SCOPED_CABANG)
      .limit(1)
    const contract = own![0]!

    // The with-check clause is what refuses this: the row would leave the caller's
    // scope in the same statement that updates it.
    const { error } = await client
      .from('contracts')
      .update({ cabang: elsewhere.cabang })
      .eq('id', contract.id)
      .select('id')

    expect(error).not.toBeNull()

    const { data: after } = await client
      .from('contracts')
      .select('cabang')
      .eq('id', contract.id)
      .single()
    expect(after!.cabang).toBe(SCOPED_CABANG)
  })

  it('may author and withdraw a scenario on one of their own contracts', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const {
      data: { user },
    } = await client.auth.getUser()
    const { data: own } = await client
      .from('contracts')
      .select('id, tarif, cost')
      .eq('cabang', SCOPED_CABANG)
      .limit(1)
    const contract = own![0]!

    const { data: draft, error } = await client
      .from('scenarios')
      .insert({
        contract_id: contract.id,
        nama: 'Usulan dari cabang',
        proposed_tarif: Number(contract.tarif),
        proposed_cost: Number(contract.cost),
        author_id: user!.id,
      })
      .select('id')
      .single()

    expect(error).toBeNull()

    const { data: removed } = await client
      .from('scenarios')
      .delete()
      .eq('id', draft!.id)
      .select('id')
    expect(removed).toHaveLength(1)
  })
})
