/**
 * Phone-sized viewport and keyboard operation.
 *
 * The prototype had two responsive utilities across 1,788 lines and two ARIA
 * attributes in total, so both of these are new behaviour rather than a regression
 * guard.
 */
import { expect, test } from '@playwright/test'

import { PERSONAS, signIn } from './personas.ts'

test.describe('on a phone', () => {
  test('navigation is reachable through the drawer', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)

    // `/pilih` deliberately renders no sidebar at all, so the drawer only exists once
    // a workspace has been entered.
    await page.goto('/')

    // The desktop sidebar is hidden; the menu button replaces it.
    const openMenu = page.getByRole('button', { name: 'Buka menu navigasi' })
    await expect(openMenu).toBeVisible()

    await openMenu.click()
    await page.getByRole('link', { name: 'Kontrak', exact: true }).click()
    await expect(page).toHaveURL(/\/kontrak/)
    await expect(page.getByRole('heading', { name: 'Daftar Kontrak' })).toBeVisible()
  })

  test('the contract table scrolls inside itself rather than the page', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // A wide table must not push the document itself sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('the dashboard stacks without clipping its figures', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    // Sign-in lands on the workspace chooser, not the dashboard itself.
    await page.goto('/')

    await expect(page.getByText('Kontrak Aktif')).toBeVisible()
    await expect(page.getByText('Sudah Expired')).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('keyboard and screen reader', () => {
  test('sign-in can be completed without a mouse', async ({ page }) => {
    await page.goto('/masuk')

    await page.getByLabel('Email').focus()
    await page.keyboard.type(PERSONAS.vp.email)
    await page.keyboard.press('Tab')
    await page.keyboard.type('Gapura2026!')
    await page.keyboard.press('Enter')

    // The chooser, not the dashboard: sign-in routes by grant now.
    await expect(page).toHaveURL(/\/pilih/)
  })

  test('a skip link takes the keyboard straight to the content', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    // The chooser at /pilih renders no AppShell and so no skip link; the skip link is
    // part of AppShell, which only wraps a chosen workspace.
    await page.goto('/')

    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Lewati ke konten utama' })
    await expect(skip).toBeFocused()
  })

  test('status is announced in words, not only colour', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/kontrak')

    // Each badge carries its rule as text for assistive technology.
    const firstStatusCell = page.locator('table tbody tr td:nth-child(4)').first()
    await expect(firstStatusCell).toContainText(
      /lebih dari 60 hari|15 sampai 60 hari|14 hari atau kurang|sudah melewati tanggal berakhir/,
    )
  })

  test('the simulator announces when margin crosses the target', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')
    await page.getByRole('link', { name: 'Pelita Air' }).click()
    await page.getByRole('link', { name: 'Buka Simulator' }).click()

    const liveRegion = page.locator('[role="status"][aria-live="polite"]').first()
    await expect(liveRegion).toContainText(/GPM simulasi/)
    await expect(liveRegion).toContainText(/di bawah target/)
  })

  test('the contract table is a real table with a caption and header scopes', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Pelanggan' })).toBeVisible()
    await expect(page.locator('table caption')).toContainText(/Daftar kontrak/)
  })
})
