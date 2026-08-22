/**
 * The write paths: editing a contract, and taking a scenario through the approval
 * machine including the counterparty's notification.
 */
import { expect, test } from '@playwright/test'

import { clickWhenReady, PERSONAS, setSlider, signIn } from './personas.ts'

/** Opens the named customer's contract detail as the given persona. */
const openContract = async (page: import('@playwright/test').Page, customer: string) => {
  await page.goto('/kontrak')
  await page.getByRole('link', { name: customer }).click()
  await expect(page.getByRole('heading', { name: customer })).toBeVisible()
}

/*
 * "editing a contract" used to live here — three specs driving the edit form. The form
 * is gone: the Sheet owns contracts and the web is a mirror, so there is no longer any
 * behaviour to assert. Withdrawn rather than skipped; a skipped spec is a claim that
 * something is temporarily broken.
 */

test.describe('the simulator', () => {
  test('moving tarif recomputes margin against this contract´s own target', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')
    await page.getByRole('link', { name: 'Pelita Air' }).click()
    await page.getByRole('link', { name: 'Buka Simulator' }).click()

    // Seeded at 22,5% against a 25% target — the panel opens in the breaching state.
    await expect(page.getByRole('heading', { name: 'Di bawah target margin' })).toBeVisible()
    await expect(page.getByText('Tarif minimum untuk target')).toBeVisible()

    // Raising the tarif far enough (minimum for target is ~16.533.333) crosses the
    // target and flips the panel.
    await setSlider(page.getByLabel('Tarif', { exact: true }), 17000000)
    await expect(page.getByRole('heading', { name: 'Memenuhi target margin' })).toBeVisible()

    // Reset returns to the contract's real figures.
    await page.getByRole('button', { name: 'Kembalikan ke angka kontrak' }).click()
    await expect(page.getByRole('heading', { name: 'Di bawah target margin' })).toBeVisible()
  })

  test('a written insight accompanies the result', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/simulator')
    await page.getByRole('link', { name: /DPR RI/ }).click()

    await expect(page.getByRole('heading', { name: 'Ringkasan untuk Negosiasi' })).toBeVisible()
    await expect(page.getByText(/Pada tarif Rp/)).toBeVisible()
  })
})

test.describe('the approval round trip', () => {
  test('a scenario is saved, submitted, approved, and the author is notified', async ({
    page,
    browser,
  }) => {
    const scenarioName = `Uji persetujuan ${Date.now()}`

    // Commercial authors and submits.
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/simulator')
    await page.getByRole('link', { name: /Super Air Jet/ }).click()

    // Minimum for target is ~13.866.667, so this comfortably meets it.
    await setSlider(page.getByLabel('Tarif', { exact: true }), 14000000)
    await page.getByLabel('Nama skenario').fill(scenarioName)
    await page.getByRole('button', { name: 'Simpan Skenario' }).click()
    await expect(page.getByText('Skenario tersimpan sebagai draft.')).toBeVisible()

    await page.reload()
    const row = page.locator('li').filter({ hasText: scenarioName })
    await expect(row.getByText('Draft')).toBeVisible()

    await row.getByRole('button', { name: 'Ajukan' }).click()
    await expect(page.getByText('Skenario diajukan untuk persetujuan VP.')).toBeVisible()

    // The VP decides, in a separate session.
    const vpContext = await browser.newContext()
    const vpPage = await vpContext.newPage()
    await signIn(vpPage, PERSONAS.vp.email)
    await vpPage.goto('/persetujuan')

    const queued = vpPage.locator('li').filter({ hasText: scenarioName })
    await expect(queued).toBeVisible()
    // Proposed against current, judged against target.
    await expect(queued.getByRole('columnheader', { name: 'Usulan' })).toBeVisible()
    await expect(queued.getByRole('columnheader', { name: 'Saat Ini' })).toBeVisible()
    await expect(queued.getByText(/memenuhi target margin kontrak/)).toBeVisible()

    await queued.getByRole('button', { name: 'Setujui' }).click()
    await expect(vpPage.getByText(/Skenario disetujui\. Commercial telah diberi tahu/)).toBeVisible()
    await expect(vpPage.locator('li').filter({ hasText: scenarioName })).toHaveCount(0)
    await vpContext.close()

    // The author is told, and the decision is final.
    await page.goto('/notifikasi')
    await expect(page.getByText('Skenario disetujui').first()).toBeVisible()

    await page.goto('/simulator')
    await page.getByRole('link', { name: /Super Air Jet/ }).click()
    const decided = page.locator('li').filter({ hasText: scenarioName })
    await expect(decided.getByText('Disetujui')).toBeVisible()
    // A decided scenario offers no further action.
    await expect(decided.getByRole('button', { name: 'Ajukan' })).toHaveCount(0)
  })

  test('a rejection requires a reason and reaches the author', async ({ page, browser }) => {
    const scenarioName = `Uji penolakan ${Date.now()}`

    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/simulator')
    await page.getByRole('link', { name: /Jogja Flight/ }).click()

    await page.getByLabel('Nama skenario').fill(scenarioName)
    await page.getByRole('button', { name: 'Simpan Skenario' }).click()
    await expect(page.getByText('Skenario tersimpan sebagai draft.')).toBeVisible()

    await page.reload()
    await page
      .locator('li')
      .filter({ hasText: scenarioName })
      .getByRole('button', { name: 'Ajukan' })
      .click()
    await expect(page.getByText('Skenario diajukan untuk persetujuan VP.')).toBeVisible()

    const vpContext = await browser.newContext()
    const vpPage = await vpContext.newPage()
    await signIn(vpPage, PERSONAS.vp.email)
    await vpPage.goto('/persetujuan')

    const queued = vpPage.locator('li').filter({ hasText: scenarioName })
    await queued.getByRole('button', { name: 'Tolak' }).click()
    await queued.getByLabel('Alasan penolakan (wajib)').fill('Margin belum cukup untuk lini ini.')
    await queued.getByRole('button', { name: 'Konfirmasi Penolakan' }).click()
    await expect(vpPage.getByText(/Skenario ditolak\. Commercial telah diberi tahu/)).toBeVisible()
    await expect(vpPage.locator('li').filter({ hasText: scenarioName })).toHaveCount(0)
    await vpContext.close()

    await page.goto('/notifikasi')
    await expect(page.getByText('Skenario ditolak').first()).toBeVisible()
    await expect(page.getByText(/Margin belum cukup untuk lini ini/)).toBeVisible()
  })
})

test.describe('reminders and notifications', () => {
  test('a reminder sent on demand is recorded and actually emailed', async ({ page, request }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kritis')

    const entry = page.locator('li').filter({ hasText: 'Mengapa perlu perhatian:' }).first()
    const customer = (await entry.locator('a').first().innerText()).trim()

    await entry.getByRole('button', { name: 'Kirim Reminder' }).click()

    // Either it went now, or the same milestone had already been sent — both are
    // correct outcomes of an idempotent trigger, and neither is a failure.
    await expect(entry.getByText(/Reminder terkirim|sudah pernah dikirim/)).toBeVisible()

    // It reaches the notification centre either way.
    await page.goto('/notifikasi')
    await expect(page.getByText(customer).first()).toBeVisible()

    /*
     * And a real message reached a real SMTP server. This is the stack's own Mailpit,
     * not Gmail — no third-party credentials are involved and nothing leaves the
     * machine, so asserting it proves the delivery path rather than proving a mock.
     * Every message must carry the non-production recipient override.
     */
    const inbox = await request.get('http://127.0.0.1:54324/api/v1/messages?limit=50')
    const messages = (await inbox.json()) as {
      messages_count: number
      messages: { Subject: string; To: { Address: string }[] }[]
    }

    expect(messages.messages_count).toBeGreaterThan(0)
    for (const message of messages.messages) {
      expect(message.To.map((to) => to.Address)).toEqual(['demo-inbox@gapura.local'])
    }
  })

  test('prompting one contract does not flush the whole backlog', async ({ page, request }) => {
    /*
     * Selection is scoped to the chosen contract, but delivery once was not: it sent
     * every notification still owed an email. Pressing the button on a single
     * contract then emptied the entire outstanding queue in one go, which is not
     * what anyone pressing it expects.
     */
    const inboxCount = async (): Promise<number> => {
      const response = await request.get('http://127.0.0.1:54324/api/v1/messages?limit=1')
      return ((await response.json()) as { messages_count: number }).messages_count
    }

    // Build a backlog: record every due reminder without delivering any of them.
    const rpc = await request.post(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/send_expiry_reminders`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          'Content-Type': 'application/json',
        },
        data: {},
      },
    )
    expect(rpc.ok()).toBe(true)
    expect(((await rpc.json()) as unknown[]).length).toBeGreaterThan(1)

    const before = await inboxCount()

    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kritis')
    const entry = page.locator('li').filter({ hasText: 'Mengapa perlu perhatian:' }).first()
    await entry.getByRole('button', { name: 'Kirim Reminder' }).click()
    await expect(entry.getByText(/Reminder terkirim|sudah pernah dikirim/)).toBeVisible()

    // At most one new message, however many were queued behind it.
    expect(await inboxCount()).toBeLessThanOrEqual(before + 1)
  })

  test('notifications can be filtered and marked read', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/notifikasi')

    await page.getByRole('button', { name: 'Kritis', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Kritis', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const markAll = page.getByRole('button', { name: 'Tandai semua dibaca' })
    if (await markAll.isVisible()) {
      await markAll.click()
      await expect(markAll).toHaveCount(0)
    }
  })
})

/*
 * "volume and revenue" went the same way. It recorded a volume through the edit form
 * to turn tarif into revenue; with no form there is no path to set one from the web,
 * and `contracts.volume` is now only ever written by a seed.
 */
