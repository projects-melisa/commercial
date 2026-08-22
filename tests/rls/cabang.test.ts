/**
 * Seam 1 — the station boundary, as it now stands.
 *
 * A GM Cabang used to hold Commercial's authority over one airport's contracts. Under
 * the nine-role model they hold none: their whole grant is `pendapatan`, `notifikasi`
 * and `report_links`, and the boundary they demonstrate is on `ancillary_revenues`,
 * the one table that carries a real station column.
 *
 * Both halves are asserted, because either failing alone is invisible from the
 * browser. Too much visible looks like a bigger branch; too little looks like a quiet
 * month. Only a row count against a known figure tells them apart.
 */
import { describe, expect, it } from 'vitest'

import { ACCOUNTS, SCOPED_CABANG, signInAs } from './client.ts'

describe('a GM Cabang reads their own station and nothing else', () => {
  it(`sees only ${SCOPED_CABANG} rows in ancillary_revenues`, async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data, error } = await client.from('ancillary_revenues').select('cab')

    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    expect(new Set(data!.map((row) => row.cab))).toEqual(new Set([SCOPED_CABANG]))
  })

  it('sees strictly fewer revenue rows than a portfolio-wide reader', async () => {
    const [cabang, dirut] = await Promise.all([
      signInAs(ACCOUNTS.cabang.email),
      signInAs(ACCOUNTS.dirut.email),
    ])

    // `head` with an exact count: the row bodies are irrelevant and the book is well
    // past PostgREST's 1000-row default, which would silently cap a plain select and
    // make two different scopes look identical at exactly 1000 apiece.
    const mine = await cabang.from('ancillary_revenues').select('*', { count: 'exact', head: true })
    const all = await dirut.from('ancillary_revenues').select('*', { count: 'exact', head: true })

    expect(mine.count!).toBeGreaterThan(0)
    expect(mine.count!).toBeLessThan(all.count!)
  })

  it('carries no business-line confinement — every line at that station is theirs', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data } = await client.from('ancillary_revenues').select('group_1_gl')

    // A station-scoped profile holds a null business line, which the policies read as
    // "all of them". More than one line coming back is what proves the two axes
    // compose rather than one silently standing in for the other.
    expect(new Set(data!.map((row) => row.group_1_gl)).size).toBeGreaterThan(1)
  })
})

describe('a GM Cabang reaches none of the KPS-only tables', () => {
  it.each([
    ['contracts'],
    ['customers'],
    ['cases'],
    ['receivables'],
  ] as const)('%s returns nothing', async (table) => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data, error } = await client.from(table).select('*')

    // No policy grants them the table, so the answer is an empty set rather than an
    // error: the rows simply do not exist for that session.
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})

describe('a GM Cabang writes nothing at all', () => {
  it('cannot insert a revenue row for their own station', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { error } = await client.from('ancillary_revenues').insert({
      cab: SCOPED_CABANG,
      plan_actual: 'Actual',
      customer: 'Uji Tulis Cabang',
      periode: '2026-01-01',
      tahun: 2026,
      production: 1,
      total: 1,
    })

    // Revenue is maintained in the Sheet and arrives through the daily pull under the
    // service role. There is no insert policy for anyone, and that is the point.
    expect(error).not.toBeNull()
  })

  it('cannot update a revenue row it can see', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data: target } = await client.from('ancillary_revenues').select('id, total').limit(1)
    const row = target![0]!

    const { data: updated } = await client
      .from('ancillary_revenues')
      .update({ total: 1 })
      .eq('id', row.id)
      .select('id')
    expect(updated ?? []).toEqual([])

    const { data: after } = await client
      .from('ancillary_revenues')
      .select('total')
      .eq('id', row.id)
      .single()
    expect(Number(after!.total)).toBe(Number(row.total))
  })
})
