/**
 * Seam 2, continued — who may move a scenario through the approval machine.
 *
 *   draft ──submit──▶ pending ──approve──▶ approved   (terminal)
 *                        │
 *                        └────reject───▶ rejected     (terminal)
 */
import { afterEach, describe, expect, it } from 'vitest'

import { ACCOUNTS, serviceClient, signInAs, type Client } from './client.ts'

const created: string[] = []

afterEach(async () => {
  if (created.length === 0) return
  const service = serviceClient()
  await service.from('scenarios').delete().in('id', created.splice(0))
})

/** A fresh draft against one of the author's own contracts. */
const draftFor = async (client: Client, email: string, nama: string) => {
  const { data: contracts } = await client.from('contracts').select('id, tarif, cost').limit(1)
  const contract = contracts![0]!
  const {
    data: { user },
  } = await client.auth.getUser()

  const { data, error } = await client
    .from('scenarios')
    .insert({
      contract_id: contract.id,
      nama,
      proposed_tarif: Number(contract.tarif) * 1.1,
      proposed_cost: Number(contract.cost),
      author_id: user!.id,
    })
    .select('*')
    .single()

  if (error) throw new Error(`could not create a draft as ${email}: ${error.message}`)
  created.push(data!.id)
  return data!
}

describe('authoring a scenario', () => {
  it('a Commercial user may author against a contract in their own line', async () => {
    const client = await signInAs(ACCOUNTS.groundHandling.email)
    const scenario = await draftFor(client, ACCOUNTS.groundHandling.email, 'Usulan kenaikan tarif')

    expect(scenario.status).toBe('draft')
    // GPM is computed by the database, not supplied by the caller. The column is
    // numeric(6,5), so it is stored to five decimal places.
    expect(Number(scenario.gpm)).toBeCloseTo(
      (Number(scenario.proposed_tarif) - Number(scenario.proposed_cost)) /
        Number(scenario.proposed_tarif),
      5,
    )
  })

  it('a Commercial user cannot author against another line´s contract', async () => {
    const cargo = await signInAs(ACCOUNTS.cargo.email)
    const vp = await signInAs(ACCOUNTS.vp.email)
    const {
      data: { user },
    } = await cargo.auth.getUser()

    const { data: outOfScope } = await vp
      .from('contracts')
      .select('id')
      .eq('business_line', 'Ground Handling')
      .limit(1)

    const { error } = await cargo.from('scenarios').insert({
      contract_id: outOfScope![0]!.id,
      nama: 'Di luar lini',
      proposed_tarif: 1000,
      proposed_cost: 500,
      author_id: user!.id,
    })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/row-level security/i)
  })

  it('a Commercial user cannot author in someone else´s name', async () => {
    const client = await signInAs(ACCOUNTS.groundHandling.email)
    const vpClient = await signInAs(ACCOUNTS.vp.email)
    const {
      data: { user: vpUser },
    } = await vpClient.auth.getUser()
    const { data: contracts } = await client.from('contracts').select('id').limit(1)

    const { error } = await client.from('scenarios').insert({
      contract_id: contracts![0]!.id,
      nama: 'Atas nama orang lain',
      proposed_tarif: 1000,
      proposed_cost: 500,
      author_id: vpUser!.id,
    })

    expect(error).not.toBeNull()
  })

  it('a VP cannot author a scenario: the monitoring role does not propose pricing', async () => {
    const vp = await signInAs(ACCOUNTS.vp.email)
    const {
      data: { user },
    } = await vp.auth.getUser()
    const { data: contracts } = await vp.from('contracts').select('id').limit(1)

    const { error } = await vp.from('scenarios').insert({
      contract_id: contracts![0]!.id,
      nama: 'Usulan VP',
      proposed_tarif: 1000,
      proposed_cost: 500,
      author_id: user!.id,
    })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/row-level security/i)
  })
})

describe('deciding a scenario', () => {
  const submit = async (client: Client, id: string) => {
    const { error } = await client.from('scenarios').update({ status: 'pending' }).eq('id', id)
    expect(error).toBeNull()
  }

  it('only the author may submit their own draft', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const other = await signInAs(ACCOUNTS.cargo.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Untuk diajukan')

    const { data: byOther } = await other
      .from('scenarios')
      .update({ status: 'pending' })
      .eq('id', scenario.id)
      .select('id')
    expect(byOther ?? []).toEqual([])

    await submit(author, scenario.id)
    const { data: after } = await author
      .from('scenarios')
      .select('status')
      .eq('id', scenario.id)
      .single()
    expect(after!.status).toBe('pending')
  })

  it('a Commercial user cannot approve their own scenario', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Coba setujui sendiri')
    await submit(author, scenario.id)

    const { data } = await author
      .from('scenarios')
      .update({ status: 'approved', decided_by: scenario.author_id, decided_at: new Date().toISOString() })
      .eq('id', scenario.id)
      .select('id')

    expect(data ?? []).toEqual([])
  })

  it('a VP may approve a pending scenario, and the author is notified', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const vp = await signInAs(ACCOUNTS.vp.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Untuk disetujui')
    await submit(author, scenario.id)

    const {
      data: { user: vpUser },
    } = await vp.auth.getUser()
    const { error } = await vp
      .from('scenarios')
      .update({
        status: 'approved',
        decided_by: vpUser!.id,
        decided_at: new Date().toISOString(),
      })
      .eq('id', scenario.id)
    expect(error).toBeNull()

    const { data: notifications } = await author
      .from('notifications')
      .select('title, contract_id')
      .eq('contract_id', scenario.contract_id)
      .order('created_at', { ascending: false })
    expect(notifications!.some((n) => n.title.includes('disetujui'))).toBe(true)
  })

  it('a rejection must carry a reason', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const vp = await signInAs(ACCOUNTS.vp.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Untuk ditolak')
    await submit(author, scenario.id)

    const {
      data: { user: vpUser },
    } = await vp.auth.getUser()

    const withoutReason = await vp
      .from('scenarios')
      .update({ status: 'rejected', decided_by: vpUser!.id, decided_at: new Date().toISOString() })
      .eq('id', scenario.id)
    expect(withoutReason.error).not.toBeNull()

    const withReason = await vp
      .from('scenarios')
      .update({
        status: 'rejected',
        decided_by: vpUser!.id,
        decided_at: new Date().toISOString(),
        rejection_reason: 'Margin masih di bawah target lini.',
      })
      .eq('id', scenario.id)
    expect(withReason.error).toBeNull()
  })

  it('a decided scenario is unchangeable, so the record of what was approved holds', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const vp = await signInAs(ACCOUNTS.vp.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Sudah diputuskan')
    await submit(author, scenario.id)

    const {
      data: { user: vpUser },
    } = await vp.auth.getUser()
    await vp
      .from('scenarios')
      .update({ status: 'approved', decided_by: vpUser!.id, decided_at: new Date().toISOString() })
      .eq('id', scenario.id)

    // Neither party can revisit it, and neither can edit the figures behind it.
    const reopenedByVp = await vp
      .from('scenarios')
      .update({ status: 'rejected', rejection_reason: 'Berubah pikiran' })
      .eq('id', scenario.id)
      .select('id')
    expect(reopenedByVp.data ?? []).toEqual([])

    const editedByAuthor = await author
      .from('scenarios')
      .update({ proposed_tarif: 1 })
      .eq('id', scenario.id)
      .select('id')
    expect(editedByAuthor.data ?? []).toEqual([])
  })

  it('a pending scenario´s figures are frozen while it awaits a decision', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Menunggu keputusan')
    await submit(author, scenario.id)

    const { error } = await author
      .from('scenarios')
      .update({ proposed_tarif: 999 })
      .eq('id', scenario.id)

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/pending scenario cannot be edited/i)
  })

  it('a scenario cannot skip the pending step', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const vp = await signInAs(ACCOUNTS.vp.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Lompat status')

    const {
      data: { user: vpUser },
    } = await vp.auth.getUser()
    const { data } = await vp
      .from('scenarios')
      .update({ status: 'approved', decided_by: vpUser!.id, decided_at: new Date().toISOString() })
      .eq('id', scenario.id)
      .select('id')

    // The VP's policy only selects pending rows, so a draft is not reachable at all.
    expect(data ?? []).toEqual([])
  })
})

describe('scenario visibility', () => {
  it('a Commercial user cannot see scenarios raised against another line', async () => {
    const author = await signInAs(ACCOUNTS.groundHandling.email)
    const other = await signInAs(ACCOUNTS.cargo.email)
    const scenario = await draftFor(author, ACCOUNTS.groundHandling.email, 'Rahasia lini lain')

    const { data } = await other.from('scenarios').select('id').eq('id', scenario.id)
    expect(data).toEqual([])
  })

  it('a VP sees scenarios from every line', async () => {
    const author = await signInAs(ACCOUNTS.ancillary.email)
    const vp = await signInAs(ACCOUNTS.vp.email)
    const scenario = await draftFor(author, ACCOUNTS.ancillary.email, 'Terlihat oleh VP')

    const { data } = await vp.from('scenarios').select('id').eq('id', scenario.id)
    expect(data).toHaveLength(1)
  })
})
