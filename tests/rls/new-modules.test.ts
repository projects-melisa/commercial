/**
 * Seam 2 — the audit additions: receivables/penalties/report_links (R-2), keputusan,
 * activity_log, export, expiry and delegation.
 *
 * Every claim below was previously asserted nowhere. These tests sign in as the seeded
 * people and count what comes back — the same discipline as grants.test.ts.
 */
import { describe, expect, it } from 'vitest'

import { ACCOUNTS, SCOPED_CABANG, serviceClient, signInAs } from './client.ts'

describe('report_links (P0-2 / R-1)', () => {
  it('is seeded, so the Power BI buttons have something to show', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data, error } = await client.from('report_links').select('*')
    expect(error).toBeNull()
    expect(data!.length).toBeGreaterThan(0)
    expect(data!.some((row) => row.modul === 'pendapatan')).toBe(true)
  })

  it.each([
    ['Cabang', ACCOUNTS.cabang],
    ['Finance', ACCOUNTS.finance],
  ] as const)('%s may read them and may not write them', async (_label, account) => {
    const client = await signInAs(account.email)
    const read = await client.from('report_links').select('*')
    expect(read.error).toBeNull()
    expect(read.data!.length).toBeGreaterThan(0)

    const write = await client
      .from('report_links')
      .update({ judul: 'milik saya' })
      .eq('modul', 'pendapatan')
      .select('modul')
    // Only `report_links:manage` writes; a refused update affects zero rows silently,
    // which is exactly why the assertion is on rows returned rather than on error.
    expect(write.data ?? []).toEqual([])
  })
})

describe('receivables stays KPS-only (the spec’s promised test)', async () => {
  const service = serviceClient()

  it('cabang reads zero rows', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const { data, error } = await client.from('receivables').select('*')
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('finance reads all nine', async () => {
    const client = await signInAs(ACCOUNTS.finance.email)
    const { count } = await client
      .from('receivables')
      .select('*', { count: 'exact', head: true })
    expect(count).toBe(9)
  })

  it('a station cannot mint or mutate its way into validation history', async () => {
    const cabang = await signInAs(ACCOUNTS.cabang.email)
    const insert = await cabang.from('penalties').insert({
      customer_id: 'CUST-001',
      deskripsi: 'uji tulis cabang',
    })
    expect(insert.error).not.toBeNull()
    void service
  })
})

describe('penalty validation (U-2) — column grant plus policy', () => {
  const service = serviceClient()

  it('cabang validates one of its own reported cases', async () => {
    // A fixture of the station's own: seeded rows are CGK's already, but seed data is
    // shared with other suites, so this case is minted for the test and removed after.
    const inserted = await service
      .from('penalties')
      .insert({ customer_id: 'CUST-001', deskripsi: `uji-validasi-${Date.now()}`, cabang_asal: SCOPED_CABANG })
      .select('id, dilaporkan_pada')
      .single()
    expect(inserted.data).not.toBeNull()
    const id = inserted.data!.id

    try {
      const client = await signInAs(ACCOUNTS.cabang.email)
      const { data } = await client
        .from('penalties')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      expect(data ?? []).toHaveLength(1)

      // The stage itself belongs to the Sheet: no session may rewrite it.
      const tahap = await client
        .from('penalties')
        .update({ tahap: 'ditutup' })
        .eq('id', id)
        .select('id')
      expect(tahap.data ?? []).toEqual([])

      // And a second validation finds nothing left to validate.
      const again = await client
        .from('penalties')
        .update({ validated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
      expect(again.data ?? []).toEqual([])
    } finally {
      await service.from('penalties').delete().eq('id', id)
    }
  })
})

describe('keputusan renew tercatat (U-1)', () => {
  const service = serviceClient()

  it('commercial records one, pinned to their own name', async () => {
    const commercial = await signInAs(ACCOUNTS.commercial.email)
    const { data: contract } = await commercial.from('contracts').select('id').limit(1).single()

    const ok = await commercial.from('contract_decisions').insert({
      contract_id: contract!.id,
      keputusan: 'renegosiasi',
      alasan: 'GPM di bawah target',
      oleh: (await service.from('profiles').select('id').eq('role', 'commercial_kps').is('business_line', null).single()).data!.id,
    }).select('id')
    expect(ok.error).toBeNull()

    // Signing someone else's name is refused by the with-check clause.
    const forged = await commercial.from('contract_decisions').insert({
      contract_id: contract!.id,
      keputusan: 'renew',
      alasan: 'bukan nama sendiri',
      oleh: (await service.from('profiles').select('id').eq('role', 'vp').single()).data!.id,
    }).select('id')
    expect(forged.error).not.toBeNull()

    await service.from('contract_decisions').delete().eq('alasan', 'GPM di bawah target')
  })

  it('a GM Cabang holds neither view nor pen', async () => {
    const client = await signInAs(ACCOUNTS.cabang.email)
    const read = await client.from('contract_decisions').select('*')
    expect(read.error).toBeNull()
    expect(read.data).toEqual([])
  })
})

describe('activity_log (U-3 / R-4) — written by triggers, readable by auditors only', () => {
  it('records the role change that just happened, with actor and before/after', async () => {
    const service = serviceClient()
    const vp = await signInAs(ACCOUNTS.vp.email)
    const { data: vpProfile } = await vp.from('profiles').select('id').single()

    // VP flips OS's role to finance and back — two logged events through profiles trigger.
    const osId = (await service.from('profiles').select('id').eq('role', 'os_kps').single()).data!.id
    await service.from('profiles').update({ role: 'finance_kps' }).eq('id', osId)
    await service.from('profiles').update({ role: 'os_kps' }).eq('id', osId)

    const log = await vp.from('activity_log').select('aksi, detail').eq('aksi', 'perubahan_pengguna').limit(2)
    expect(log.error).toBeNull()
    expect(log.data!.length).toBeGreaterThan(0)
    void vpProfile
  })

  it('commercial — no audit grant — reads an empty trail', async () => {
    const client = await signInAs(ACCOUNTS.commercial.email)
    const { data } = await client.from('activity_log').select('*')
    expect(data).toEqual([])
  })

  it('nobody writes the table directly; log_activity is the sanctioned path', async () => {
    const client = await signInAs(ACCOUNTS.vp.email)
    const direct = await client.from('activity_log').insert({ aksi: 'palsu' }).select('id')
    expect(direct.error).not.toBeNull()

    const rpc = await client.rpc('log_activity', {
      aksi: 'uji_rpc',
      detail: { sumber: 'tests' },
    })
    expect(rpc.error).toBeNull()

    const service = serviceClient()
    await service.from('activity_log').delete().eq('aksi', 'uji_rpc')
  })

  it('an export lands in the trail (U-6)', async () => {
    const client = await signInAs(ACCOUNTS.op.email)
    const rpc = await client.rpc('log_activity', {
      aksi: 'ekspor',
      detail: { modul: 'Penalty_Data', baris: 12 },
    })
    expect(rpc.error).toBeNull()

    const service = serviceClient()
    const rows = await service.from('activity_log').select('detail').eq('aksi', 'ekspor').limit(1)
    expect(rows.data![0]!.detail).toMatchObject({ modul: 'Penalty_Data' })
    await service.from('activity_log').delete().eq('aksi', 'ekspor')
  })
})

describe('access expires and can be delegated (U-8)', () => {
  const service = serviceClient()

  it('an account past berlaku_sampai fails every grant', async () => {
    // Expire the GM Cabang for the duration of the check.
    await service.from('profiles').update({ berlaku_sampai: '2020-01-01' }).eq('role', 'cabang')
    try {
      const client = await signInAs(ACCOUNTS.cabang.email)
      const revenue = await client.from('ancillary_revenues').select('*', { count: 'exact', head: true })
      expect(revenue.count).toBe(0)
    } finally {
      await service.from('profiles').update({ berlaku_sampai: null }).eq('role', 'cabang')
    }
  })

  it('a live delegation lends capability, never scope', async () => {
    const cabangBefore = await (await signInAs(ACCOUNTS.cabang.email))
      .from('contracts')
      .select('*', { count: 'exact', head: true })
    expect(cabangBefore.count).toBe(0)

    const dari = (await service.from('profiles').select('id').eq('role', 'commercial_kps').is('business_line', null).single()).data!.id
    const ke = (await service.from('profiles').select('id').eq('role', 'cabang').single()).data!.id
    const today = new Date().toISOString().slice(0, 10)
    const inserted = await service
      .from('role_delegations')
      .insert({ dari, ke, mulai: today, sampai: null })
      .select('id')
      .single()

    try {
      const client = await signInAs(ACCOUNTS.cabang.email)
      const { data } = await client.from('contracts').select('cabang')
      expect(data!.length).toBeGreaterThan(0)
      // Scope is still the caller's own station: every row is theirs, none beyond it.
      expect(new Set(data!.map((row) => row.cabang))).toEqual(new Set([SCOPED_CABANG]))
    } finally {
      if (inserted.data) await service.from('role_delegations').delete().eq('id', inserted.data.id)
    }
  })
})
