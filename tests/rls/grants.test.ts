/**
 * Seam 1 — the grant matrix, asserted role by role.
 *
 * Every row here is a line from the client's access matrix, checked by signing in as
 * that person and counting what comes back. Nothing is mocked and nothing is inferred
 * from the interface: the interface reads the same grant table, so testing it would
 * only prove the two agree, not that either is right.
 *
 * The counts are relative rather than absolute wherever the daily pull can move them.
 * A test that hardcodes "1056 revenue rows" fails the first morning the Sheet grows a
 * row, which teaches everyone to ignore it.
 */
import { describe, expect, it } from 'vitest'

import { ACCOUNTS, serviceClient, signInAs } from './client.ts'

const ALL = [
  ['Commercial', ACCOUNTS.commercial],
  ['VP', ACCOUNTS.vp],
  ['Direktur Utama', ACCOUNTS.dirut],
  ['Cabang', ACCOUNTS.cabang],
  ['Finance', ACCOUNTS.finance],
  ['OP', ACCOUNTS.op],
  ['OS', ACCOUNTS.os],
  ['OCS', ACCOUNTS.ocs],
  ['Super Admin', ACCOUNTS.superAdmin],
] as const

/** Exact count via `head`, so a table past PostgREST's 1000-row default is counted whole. */
const count = async (email: string, table: 'contracts' | 'receivables' | 'penalties' | 'ancillary_revenues' | 'cases' | 'customers'): Promise<number> => {
  const client = await signInAs(email)
  const { count: total, error } = await client.from(table).select('*', { count: 'exact', head: true })
  expect(error).toBeNull()
  return total ?? 0
}

describe('piutang is Finance, Commercial and the executives — nobody else', () => {
  it.each([
    ['Commercial', ACCOUNTS.commercial],
    ['VP', ACCOUNTS.vp],
    ['Direktur Utama', ACCOUNTS.dirut],
    ['Finance', ACCOUNTS.finance],
  ] as const)('%s reads all nine receivable rows', async (_label, account) => {
    expect(await count(account.email, 'receivables')).toBe(9)
  })

  it.each([
    ['OP', ACCOUNTS.op],
    ['OS', ACCOUNTS.os],
    ['OCS', ACCOUNTS.ocs],
    ['Cabang', ACCOUNTS.cabang],
    ['Super Admin', ACCOUNTS.superAdmin],
  ] as const)('%s reads none', async (_label, account) => {
    expect(await count(account.email, 'receivables')).toBe(0)
  })
})

describe('penalty reaches every KPS role; a station sees its own cases (U-2)', () => {
  it.each([
    ['Commercial', ACCOUNTS.commercial],
    ['VP', ACCOUNTS.vp],
    ['Direktur Utama', ACCOUNTS.dirut],
    ['Finance', ACCOUNTS.finance],
    ['OP', ACCOUNTS.op],
    ['OS', ACCOUNTS.os],
    ['OCS', ACCOUNTS.ocs],
  ] as const)('%s reads the whole penalty book', async (_label, account) => {
    expect(await count(account.email, 'penalties')).toBeGreaterThan(0)
  })

  it('the GM Cabang reads their station’s cases, not the book', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data, error } = await client.from('penalties').select('cabang_asal')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    expect(new Set(data!.map((row) => row.cabang_asal))).toEqual(new Set(['CGK']))
  })

  it.each([['Super Admin', ACCOUNTS.superAdmin]] as const)('%s reads none', async (_label, account) => {
    expect(await count(account.email, 'penalties')).toBe(0)
  })
})

describe('pendapatan reaches headquarters; each station reads itself alone', () => {
  it.each([
    ['Commercial', ACCOUNTS.commercial],
    ['VP', ACCOUNTS.vp],
    ['Direktur Utama', ACCOUNTS.dirut],
    ['Finance', ACCOUNTS.finance],
    ['OP', ACCOUNTS.op],
    ['OS', ACCOUNTS.os],
    ['OCS', ACCOUNTS.ocs],
  ] as const)('%s reads the whole book', async (_label, account) => {
    expect(await count(account.email, 'ancillary_revenues')).toBeGreaterThan(0)
  })

  it.each([
    ['Super Admin', ACCOUNTS.superAdmin],
  ] as const)('%s reads none', async (_label, account) => {
    expect(await count(account.email, 'ancillary_revenues')).toBe(0)
  })
})

describe('a super admin administers people and sees no business data whatsoever', () => {
  it.each([
    ['contracts'],
    ['customers'],
    ['cases'],
    ['receivables'],
    ['penalties'],
    ['ancillary_revenues'],
  ] as const)('%s is empty', async (table) => {
    expect(await count(ACCOUNTS.superAdmin.email, table)).toBe(0)
  })

  it('still reads the profiles it exists to manage', async () => {
    const client = await signInAs(ACCOUNTS.superAdmin.email)
    const { data, error } = await client.from('profiles').select('id')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(1)
  })
})

describe('role_module_grants is read-only to everyone, super admin included', () => {
  it.each(ALL)('%s can read it', async (_label, account) => {
    const client = await signInAs(account.email)
    const { data, error } = await client.from('role_module_grants').select('role, modul, aksi')

    // Deliberately world-readable: it carries no business data and the policies need
    // it legible. That is also why `getGrants` has to narrow by role in the app —
    // an unfiltered read here returns every role's grants, not the caller's.
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
  })

  it.each(ALL)('%s cannot insert into it', async (_label, account) => {
    const client = await signInAs(account.email)
    const { error } = await client
      .from('role_module_grants')
      .insert({ role: 'super_admin', modul: 'kontrak', aksi: 'view' })

    // A super admin decides *who holds which role*, never *what a role may do*. If
    // this table were writable from the application, anyone who reached it could
    // grant themselves anything.
    expect(error).not.toBeNull()
  })

  it.each(ALL)('%s cannot delete from it', async (_label, account) => {
    const client = await signInAs(account.email)
    const { data: deleted } = await client
      .from('role_module_grants')
      .delete()
      .eq('role', 'vp')
      .select('role')

    expect(deleted ?? []).toEqual([])
  })

  it('survives every one of those attempts intact', async () => {
    const { count: total } = await serviceClient()
      .from('role_module_grants')
      .select('*', { count: 'exact', head: true })

    // Guards against a delete that returned nothing because the rows were gone
    // already rather than because the policy refused it.
    expect(total).toBeGreaterThan(40)
  })
})

describe('the trigger function is not an RPC', () => {
  it('cannot be invoked over PostgREST by a signed-in caller', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    // `CREATE OR REPLACE` resets a function's grants, which briefly made this trigger
    // function callable as a public RPC. It was revoked; this is the guard so a future
    // replace cannot reopen it unnoticed.
    const { error } = await client.rpc(
      'scenarios_enforce_transitions' as never,
      {} as never,
    )

    expect(error).not.toBeNull()
  })
})
