/**
 * Seam 1 — end-to-end through the browser, driving the real interface as each persona.
 */
import { expect, test } from '@playwright/test'

import { contractRowCount, PERSONAS, signIn, signOut } from './personas.ts'

test.describe('signing in and out', () => {
  test('an unauthenticated visitor is sent to sign-in rather than a broken page', async ({
    page,
  }) => {
    await page.goto('/kontrak')
    await expect(page).toHaveURL(/\/masuk/)
    await expect(page.getByRole('heading', { name: 'Masuk ke akun Anda' })).toBeVisible()
  })

  test('a Commercial user can sign in and out', async ({ page }) => {
    await signIn(page, PERSONAS.groundHandling.email)
    await expect(
      page.getByRole('heading', { name: new RegExp(PERSONAS.groundHandling.nama) }),
    ).toBeVisible()

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
    await page.getByLabel('Kata Sandi').fill('kata-sandi-salah')
    await page.getByRole('button', { name: 'Masuk' }).click()

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

    await page.getByLabel('Email').fill(PERSONAS.ancillary.email)
    await page.getByRole('button', { name: 'Masuk' }).click()
    // Wait for the sign-in to land before navigating, or the redirect races the goto.
    await expect(page).toHaveURL(/\/$/)

    // The session is Ancillary's, not the VP's: five contracts, and no approval queue.
    await page.goto('/kontrak')
    expect(await contractRowCount(page)).toBe(5)
    await expect(page.getByRole('link', { name: 'Persetujuan' })).toHaveCount(0)
  })
})

test.describe('business-line scoping as seen in the interface', () => {
  const cases = [
    { persona: PERSONAS.groundHandling, rows: 8 },
    { persona: PERSONAS.cargo, rows: 7 },
    { persona: PERSONAS.ancillary, rows: 5 },
  ]

  for (const { persona, rows } of cases) {
    test(`${persona.businessLine} sees ${rows} contracts and no other line`, async ({ page }) => {
      await signIn(page, persona.email)
      await page.goto('/kontrak')

      expect(await contractRowCount(page)).toBe(rows)

      const lines = await page.locator('table tbody tr td:nth-child(2)').allInnerTexts()
      expect(new Set(lines.map((line) => line.trim()))).toEqual(new Set([persona.businessLine]))
    })
  }

  test('a VP sees all 20 contracts across all three lines', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/kontrak')

    expect(await contractRowCount(page)).toBe(20)

    const lines = await page.locator('table tbody tr td:nth-child(2)').allInnerTexts()
    expect(new Set(lines.map((line) => line.trim()))).toEqual(
      new Set(['Ground Handling', 'Cargo & Warehouse', 'Ancillary Business']),
    )
  })

  test('headline figures agree with the table beneath them', async ({ page }) => {
    await signIn(page, PERSONAS.cargo.email)

    // The dashboard's "Total Kontrak" card must match the contract list exactly.
    const total = await page
      .locator('p', { hasText: /^Total Kontrak$/ })
      .locator('xpath=following-sibling::p[1]')
      .innerText()
    expect(total.trim()).toBe('7')

    await page.goto('/kontrak')
    expect(await contractRowCount(page)).toBe(7)
  })

  test('the Ancillary user´s five contracts fill the screen sensibly', async ({ page }) => {
    await signIn(page, PERSONAS.ancillary.email)
    await page.goto('/kontrak')

    // A small scope should look deliberate, not broken: real rows, no empty state.
    expect(await contractRowCount(page)).toBe(5)
    await expect(page.getByText('Tidak ada kontrak yang cocok')).toHaveCount(0)
    await expect(page.getByRole('table')).toBeVisible()
  })
})

test.describe('role capabilities', () => {
  test('a VP is offered no way to edit a contract', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/kontrak')
    await page.locator('table tbody tr td:first-child a').first().click()

    await expect(page.getByText('Peran VP tidak dapat mengubah data')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ubah Kontrak' })).toHaveCount(0)
  })

  test('a Commercial user is offered the approval queue nowhere', async ({ page }) => {
    await signIn(page, PERSONAS.groundHandling.email)
    await expect(page.getByRole('link', { name: 'Persetujuan' })).toHaveCount(0)

    // And reaching for it directly lands back on the dashboard.
    await page.goto('/persetujuan')
    await expect(page).toHaveURL(/\/$/)
  })

  test('a VP reaches the approval queue', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.getByRole('link', { name: 'Persetujuan' }).click()
    await expect(page.getByRole('heading', { name: 'Antrean Persetujuan' })).toBeVisible()
  })
})
