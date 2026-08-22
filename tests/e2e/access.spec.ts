/**
 * Seam 2 — end-to-end through the browser, driving the real interface as each persona.
 *
 * The nine roles are asserted individually rather than through a representative one.
 * "Representative" is precisely the assumption that failed when the enum went from
 * three roles to nine: a predicate reading "not the VP" was correct for the three it
 * was written against and silently granted the other six everything.
 */
import { expect, test } from '@playwright/test'

import { LANDING, PERSONAS, SCOPED_CABANG, TOTAL_CONTRACTS, contractRowCount, signIn, signOut } from './personas.ts'

test.describe('signing in and out', () => {
  test('an unauthenticated visitor is sent to sign-in rather than a broken page', async ({
    page,
  }) => {
    await page.goto('/kontrak')
    await expect(page).toHaveURL(/\/masuk/)
    await expect(page.getByRole('heading', { name: 'Masuk ke akun Anda' })).toBeVisible()
  })

  test('a Commercial user can sign in and out', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await expect(page.getByRole('heading', { name: 'Pilih ruang kerja' })).toBeVisible()

    await signOut(page)
    // The session is genuinely gone, not merely navigated away from.
    await page.goto('/')
    await expect(page).toHaveURL(/\/masuk/)
  })

  test('wrong credentials are refused with a message rather than a blank screen', async ({
    page,
  }) => {
    await page.goto('/masuk')
    await page.getByLabel('Email').fill(PERSONAS.vp.email)
    await page.getByRole('textbox', { name: 'Kata Sandi' }).fill('kata-sandi-salah')
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()

    // Scoped to the form: Next renders its own empty role="alert" route announcer.
    await expect(page.locator('form').getByRole('alert')).toContainText(
      /Email atau kata sandi salah/,
    )
    await expect(page).toHaveURL(/\/masuk/)
  })

  test('the demo picker fills credentials without granting the role it names', async ({ page }) => {
    await page.goto('/masuk')

    // Choose the VP persona, then sign in with a Commercial user's credentials.
    await page.getByLabel('Akun Demo').selectOption(PERSONAS.vp.email)
    await expect(page.getByLabel('Email')).toHaveValue(PERSONAS.vp.email)

    await page.getByLabel('Email').fill(PERSONAS.commercial.email)
    await page.getByRole('button', { name: 'Masuk', exact: true }).click()
    await expect(page).toHaveURL(LANDING.kps)

    // The session is the Commercial user's, not the VP's. Both see all 15 contracts,
    // so the approval queue is what tells them apart: it belongs to the VP alone, and
    // picking the VP in the dropdown did not grant it.
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Persetujuan' })).toHaveCount(0)
    await page.goto('/persetujuan')
    await expect(page.getByText('404')).toBeVisible()
  })
})

test.describe('where each role lands, and what it is offered', () => {
  const BENTO_BOTH = ['Kontrak Commercial', 'Pendapatan']

  // All seven roles that reach `/pilih` hold both `kontrak:view` and `pendapatan:view`
  // — the four KPS units sit at the same unrestricted scope as Commercial, so there is
  // no scope reason to hand them a one-card chooser. Only `cabang` and `super_admin`
  // skip the bento entirely, covered separately below.
  const CASES = [
    ['a VP', PERSONAS.vp, BENTO_BOTH],
    ['a Direktur Utama', PERSONAS.dirut, BENTO_BOTH],
    ['a Commercial user', PERSONAS.commercial, BENTO_BOTH],
    ['a Finance user', PERSONAS.finance, BENTO_BOTH],
    ['an OP user', PERSONAS.op, BENTO_BOTH],
    ['an OS user', PERSONAS.os, BENTO_BOTH],
    ['an OCS user', PERSONAS.ocs, BENTO_BOTH],
  ] as const

  for (const [label, persona, cards] of CASES) {
    test(`${label} is shown exactly ${cards.length} workspace card(s)`, async ({ page }) => {
      await signIn(page, persona.email)

      for (const card of cards) {
        await expect(page.getByRole('heading', { name: card, exact: true })).toBeVisible()
      }
      // A card the caller has no grant for is not rendered at all. A disabled tile
      // still announces that something exists and that somebody else may see it.
      const absent = BENTO_BOTH.filter((c) => !cards.includes(c as never))
      for (const card of absent) {
        await expect(page.getByRole('heading', { name: card, exact: true })).toHaveCount(0)
      }
    })
  }

  test('the chooser renders no sidebar — it is asking which one you want', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)

    await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toHaveCount(0)
    // Still a way out, or the page would be a trap.
    await expect(page.getByRole('button', { name: 'Keluar' })).toBeVisible()
  })

  test('a GM Cabang skips the chooser entirely', async ({ page }) => {
    await signIn(page, PERSONAS.cabang.email, LANDING.cabang)

    await expect(page.getByRole('heading', { name: /^Pendapatan/ })).toBeVisible()
    // Reaching for the chooser by hand lands in the same place: one workspace is not
    // a choice.
    await page.goto('/pilih')
    await expect(page).toHaveURL(LANDING.cabang)
  })

  test('a super admin lands on user management and is offered nothing else', async ({ page }) => {
    await signIn(page, PERSONAS.superAdmin.email, LANDING.superAdmin)

    const nav = page.getByRole('navigation', { name: 'Navigasi utama' }).first()
    // Three entries: the module they administer, the audit trail (U-3), and the
    // settings page everyone gets.
    await expect(nav.getByRole('link')).toHaveCount(3)
    await expect(nav.getByRole('link', { name: 'Pengguna & Role' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Jejak Audit' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pengaturan' })).toBeVisible()
  })
})

test.describe('navigation is drawn from the grant table', () => {
  test('a GM Cabang is offered revenue, notifications and settings — nothing more', async ({
    page,
  }) => {
    await signIn(page, PERSONAS.cabang.email, LANDING.cabang)
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' }).first()

    await expect(nav.getByRole('link', { name: 'Pendapatan' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Notifikasi/ })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pengaturan' })).toBeVisible()

    for (const absent of ['Kontrak', 'Kontrak Kritis', 'Pelanggan', 'Simulator P&L', 'Laporan']) {
      await expect(nav.getByRole('link', { name: absent, exact: true })).toHaveCount(0)
    }
  })

  test('only the VP is offered the approval queue', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Persetujuan' })).toBeVisible()

    await signOut(page)
    await signIn(page, PERSONAS.dirut.email)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Persetujuan' })).toHaveCount(0)
  })

  test('a Finance user is offered contracts, not the simulator, and Pendapatan lives in its own workspace', async ({
    page,
  }) => {
    await signIn(page, PERSONAS.finance.email)
    await page.goto('/')
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' }).first()

    await expect(nav.getByRole('link', { name: 'Kontrak', exact: true })).toBeVisible()
    // Absent here because Pendapatan is the other workspace's sidebar, not because
    // Finance lacks the grant — it holds `pendapatan:view` and sees the card at
    // `/pilih`, asserted above.
    await expect(nav.getByRole('link', { name: 'Pendapatan' })).toHaveCount(0)
    // Absent here because Finance genuinely holds no `simulator:view` grant.
    await expect(nav.getByRole('link', { name: 'Simulator P&L' })).toHaveCount(0)
  })
})

test.describe('a route without its grant answers 404, not an empty page', () => {
  /*
   * 404 rather than a redirect or an "access denied" screen. A page that exists but is
   * empty still tells the caller the module is there and that somebody else can open
   * it; a bounce to the dashboard says the same thing more politely.
   */
  const FORBIDDEN = [
    [
      'a GM Cabang',
      PERSONAS.cabang,
      LANDING.cabang,
      // Not /penalty: cabang is the penalty validator (U-2) and holds penalty:view.
      ['/kontrak', '/kritis', '/pelanggan', '/simulator', '/laporan', '/piutang', '/irregularities', '/pengguna'],
    ],
    [
      'a super admin',
      PERSONAS.superAdmin,
      LANDING.superAdmin,
      ['/', '/kontrak', '/pendapatan', '/pelanggan', '/piutang', '/penalty', '/irregularities'],
    ],
    ['a Direktur Utama', PERSONAS.dirut, LANDING.kps, ['/persetujuan', '/irregularities', '/pengguna']],
    ['an OCS user', PERSONAS.ocs, LANDING.kps, ['/pelanggan', '/pendapatan', '/simulator', '/piutang']],
    ['a Commercial user', PERSONAS.commercial, LANDING.kps, ['/irregularities', '/pengguna', '/persetujuan']],
  ] as const

  for (const [label, persona, landing, routes] of FORBIDDEN) {
    test(`${label} gets 404 on ${routes.join(', ')}`, async ({ page }) => {
      await signIn(page, persona.email, landing)
      for (const route of routes) {
        await page.goto(route)
        await expect(page.getByText('404')).toBeVisible()
      }
    })
  }
})

test.describe('portfolio scope as seen in the interface', () => {
  test('a Commercial user sees every contract line across all three lines', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    expect(await contractRowCount(page)).toBe(TOTAL_CONTRACTS)

    const lines = await page.locator('table tbody tr td:nth-child(2)').allInnerTexts()
    expect(new Set(lines.map((line) => line.trim()))).toEqual(
      new Set(['Ground Handling', 'Cargo Handling', 'Ancillary Business']),
    )
  })

  test('headline figures agree with the table beneath them', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/')

    // The dashboard leads with live and lapsed rather than one total, so the check is
    // that the two headline counts partition the book — a card counting a contract
    // twice, or neither, would still look plausible on its own.
    const cardValue = async (label: string): Promise<number> =>
      Number(
        (
          await page
            .locator('p', { hasText: new RegExp(`^${label}$`) })
            .locator('xpath=following-sibling::p[1]')
            .innerText()
        ).trim(),
      )

    expect((await cardValue('Kontrak Aktif')) + (await cardValue('Sudah Expired'))).toBe(
      TOTAL_CONTRACTS,
    )

    await page.goto('/kontrak')
    expect(await contractRowCount(page)).toBe(TOTAL_CONTRACTS)
  })

  test('a small result set fills the screen sensibly rather than looking broken', async ({
    page,
  }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // No seeded account is confined to one line, so the smallest scope the interface
    // has to render well is reached by filtering. Ancillary Business is 2 of the 15
    // lines in the Sheet — a genuinely small result set.
    await page.getByLabel('Saring berdasarkan lini bisnis').selectOption('Ancillary Business')

    expect(await contractRowCount(page)).toBe(2)
    await expect(page.getByText('Tidak ada kontrak yang cocok')).toHaveCount(0)
    await expect(page.getByRole('table')).toBeVisible()
  })
})

test.describe('contracts are read-only everywhere, because the Sheet owns them', () => {
  test('no role is offered a way to create or edit one', async ({ page }) => {
    for (const persona of [PERSONAS.commercial, PERSONAS.vp]) {
      await signIn(page, persona.email)
      await page.goto('/kontrak')

      await expect(page.getByRole('link', { name: 'Kontrak Baru' })).toHaveCount(0)
      await page.locator('table tbody tr td:first-child a').first().click()
      await expect(page.getByRole('button', { name: 'Ubah Kontrak' })).toHaveCount(0)

      await signOut(page)
    }
  })

  test('the route that used to create one is gone', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak/baru')
    await expect(page.getByText('404')).toBeVisible()
  })
})

test.describe('the revenue dashboard', () => {
  test('a GM Cabang sees their station locked into the filter, not hidden from it', async ({
    page,
  }) => {
    await signIn(page, PERSONAS.cabang.email, LANDING.cabang)

    const cabang = page.getByLabel(/^Cabang/)
    await expect(cabang).toBeDisabled()
    await expect(cabang).toHaveValue(SCOPED_CABANG)
    // Visibly locked, not absent: a GM whose figures differ from the ones quoted in a
    // meeting needs to see why, and a missing control explains nothing.
    await expect(page.getByText(/Filter cabang terkunci pada/)).toBeVisible()
  })

  test('forcing another station into the URL changes nothing', async ({ page }) => {
    await signIn(page, PERSONAS.cabang.email, LANDING.cabang)
    await page.goto('/pendapatan?cab=DPS')

    await expect(page.getByLabel(/^Cabang/)).toHaveValue(SCOPED_CABANG)
    const stations = await page
      .locator('section', { has: page.getByRole('heading', { name: 'Peringkat Cabang' }) })
      .locator('tbody tr th')
      .allInnerTexts()
    expect(new Set(stations.map((s) => s.trim()))).toEqual(new Set([SCOPED_CABANG]))
  })

  test('Overview holds four sub-tabs and each one names what it counts', async ({ page }) => {
    await signIn(page, PERSONAS.dirut.email)
    await page.goto('/pendapatan')

    for (const [tab, satuan] of [
      ['Production', 'unit produksi'],
      ['Revenue (UP)', 'Rupiah'],
      ['Production (UP)', 'unit produksi'],
      ['Revenue', 'Rupiah'],
    ] as const) {
      await page.getByRole('link', { name: tab, exact: true }).click()
      await expect(
        page.getByRole('heading', { name: new RegExp(`Tren bulanan .* ${satuan}`) }),
      ).toBeVisible()
    }
  })

  test('the sub-tabs are different views, not one view four times', async ({ page }) => {
    await signIn(page, PERSONAS.dirut.email)

    // Plain tabs rank by group 1 GL; the Unit Pelaporan tabs roll up to group 2 GL.
    await page.goto('/pendapatan')
    await expect(page.getByRole('heading', { name: 'Peringkat Line of Business' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Peringkat group 2 GL' })).toHaveCount(0)

    await page.goto('/pendapatan/overview/revenue-up')
    await expect(page.getByRole('heading', { name: 'Peringkat group 2 GL' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Klasifikasi P&L' })).toBeVisible()

    // Production is the only tab carrying yield, which is what volume alone cannot say.
    await page.goto('/pendapatan/overview/production')
    await expect(page.getByRole('heading', { name: 'Yield per Line of Business' })).toBeVisible()
  })

  test('every chart carries a key', async ({ page }) => {
    await signIn(page, PERSONAS.dirut.email)
    await page.goto('/pendapatan')

    // The page carries more than one chart with the same key, so scoped to the first
    // rather than asserting there is exactly one.
    await expect(page.getByText('Aktual 2025', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('RKAP 2026', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Akumulasi RKAP 2026', { exact: true }).first()).toBeVisible()
  })

  test('LoB splits into B2C and B2B, and they report different books', async ({ page }) => {
    await signIn(page, PERSONAS.dirut.email)

    // The old CORE BUSINESS/OTHER BUSINESS proxy is gone (D-4): the split now reads
    // the customer's own `Customer Type`, so the headings name Agent/Non-Agent instead.
    await page.goto('/pendapatan/lob/b2c')
    await expect(page.getByRole('heading', { name: /Non-Agent/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sebaran RFM' })).toBeVisible()

    await page.goto('/pendapatan/lob/b2b')
    await expect(page.getByRole('heading', { name: /\(Agent\)/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Detail agen' })).toBeVisible()
  })

  test('Q&A decomposes the total and each column is filtered by the one before it', async ({
    page,
  }) => {
    await signIn(page, PERSONAS.dirut.email)
    await page.goto('/pendapatan/qna')

    await expect(page.getByRole('heading', { name: 'Decomposition Tree' })).toBeVisible()
    await expect(page.getByText(/^Actual Revenue/)).toBeVisible()

    // Three levels by default, each a column of its own.
    for (const level of ['LoB (group 1 GL)', 'Airport', 'Name']) {
      await expect(page.getByRole('heading', { name: level, exact: true })).toBeVisible()
    }

    const namesBefore = await page
      .locator('section', { has: page.getByRole('heading', { name: 'Name', exact: true }) })
      .locator('li')
      .count()

    // Drilling into one line of business must narrow every column to its right.
    await page.getByRole('link', { name: /JOUMPA/ }).first().click()
    await expect(page).toHaveURL(/jalur=/)
    const namesAfter = await page
      .locator('section', { has: page.getByRole('heading', { name: 'Name', exact: true }) })
      .locator('li')
      .count()
    expect(namesAfter).toBeLessThanOrEqual(namesBefore)

    // The path lives in the URL, so it survives a reload and can be pasted to someone.
    await page.reload()
    await expect(page.getByText('LoB (group 1 GL) · JOUMPA')).toBeVisible()
  })

  test('a tab or sub-tab that does not exist is a 404', async ({ page }) => {
    await signIn(page, PERSONAS.dirut.email)
    for (const route of ['/pendapatan/ngawur', '/pendapatan/overview/ngawur', '/pendapatan/qna/apa']) {
      await page.goto(route)
      await expect(page.getByText('404')).toBeVisible()
    }
  })
})

test.describe('the four domains, each reaching its own holder', () => {
  test('Finance reads the receivable book and its accumulated total', async ({ page }) => {
    await signIn(page, PERSONAS.finance.email)
    await page.goto('/piutang')

    await expect(page.getByRole('heading', { name: 'Piutang', exact: true })).toBeVisible()
    // Nine customers in Receivable_Data, and the footer totals them.
    expect(await page.locator('table tbody tr').count()).toBe(9)
    await expect(page.getByText('Akumulasi piutang')).toBeVisible()
  })

  test('OP reads the penalty book, and each row says where it stands', async ({ page }) => {
    await signIn(page, PERSONAS.op.email)
    await page.goto('/penalty')

    await expect(page.getByRole('heading', { name: 'Penalty', exact: true })).toBeVisible()
    expect(await page.locator('table tbody tr').count()).toBeGreaterThan(0)
    await expect(page.getByText('Belum ditutup')).toBeVisible()
  })

  test('OCS is the only role that reaches irregularities', async ({ page }) => {
    await signIn(page, PERSONAS.ocs.email)
    await page.goto('/irregularities')

    await expect(page.getByRole('heading', { name: 'Irregularities' })).toBeVisible()
    expect(await page.locator('table tbody tr').count()).toBe(10)
  })

  test('a super admin manages people and says so about the grant table', async ({ page }) => {
    await signIn(page, PERSONAS.superAdmin.email, LANDING.superAdmin)

    await expect(page.getByRole('heading', { name: 'Pengguna & Role' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Buat akun' })).toBeVisible()
    await expect(page.getByText(/hanya bisa diubah lewat migration/)).toBeVisible()
  })
})

test.describe('the contract page carries the decision, not links to it', () => {
  test('Commercial sees the receivable and penalty standing inline', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')
    await page.locator('table tbody tr td:first-child a').first().click()

    await expect(page.getByRole('heading', { name: 'Ringkasan piutang' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Ringkasan penalty' })).toBeVisible()
  })

  test('and is told plainly that irregularities are withheld, not that there are none', async ({
    page,
  }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')
    await page.locator('table tbody tr td:first-child a').first().click()

    // The distinction R-01 turns on: silence about cases must not read as "no cases".
    await expect(page.getByText(/Irregularities dipegang OCS KPS/)).toBeVisible()
    await expect(page.getByText('Belum ada kasus tercatat untuk pelanggan ini.')).toHaveCount(0)
  })
})
