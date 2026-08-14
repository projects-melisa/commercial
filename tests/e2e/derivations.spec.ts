/**
 * Derived calculations asserted through rendered output.
 *
 * GPM, margin-versus-target, status banding and Rupiah formatting across three orders
 * of magnitude get no seam of their own: what matters is what the user sees, so they
 * are checked here, on the page, against figures traceable to the source workbook.
 */
import { expect, test } from '@playwright/test'

import { PERSONAS, signIn } from './personas.ts'

test.describe('margin against each contract´s own target', () => {
  test('the one contract below its own target is shown as below target', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Samudera Cold Chain: tarif 11.000, cost 7.800 → 29,1% against a 30% target.
    await page.getByRole('link', { name: 'Samudera Cold Chain' }).click()

    await expect(page.getByText('29,1%').first()).toBeVisible()
    await expect(page.getByText('Target GPM Kontrak Ini')).toBeVisible()
    await expect(page.getByText('30,0%').first()).toBeVisible()
    await expect(
      page.getByText(/Kontrak ini berada di bawah target marginnya sendiri/),
    ).toBeVisible()
  })

  test('a contract above its own target carries no breach warning', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Garuda Nusantara: 12.500.000 / 9.000.000 → 28,0% against a 25% target.
    await page.getByRole('link', { name: 'Garuda Nusantara Airlines' }).click()

    await expect(page.getByText('28,0%').first()).toBeVisible()
    await expect(page.getByText(/berada di bawah target marginnya sendiri/)).toHaveCount(0)
  })

  test('the dashboard counts exactly one contract below target for a VP', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)

    const belowTarget = await page
      .locator('p', { hasText: /^Di Bawah Target$/ })
      .locator('xpath=following-sibling::p[1]')
      .innerText()
    expect(belowTarget.trim()).toBe('1')
  })
})

test.describe('Rupiah across three orders of magnitude', () => {
  test('a per-kg cargo tarif is not collapsed to zero', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Indo Logistic Solusi is priced at Rp 4.200 per kg — the smallest tarif in the
    // book, and the one a naive "juta" formatter would render as "Rp 0,0 jt".
    await page.getByRole('link', { name: 'Indo Logistic Solusi' }).click()

    await expect(page.getByText('Rp 4.200')).toBeVisible()
    await expect(page.getByText(/Rp 0,0 jt/)).toHaveCount(0)
  })

  test('a large flat fee renders in full on the detail page', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Angkasa Retail Group: a Rp 120.000.000 flat fee.
    await page.getByRole('link', { name: 'Angkasa Retail Group' }).click()
    await expect(page.getByText('Rp 120.000.000')).toBeVisible()
  })

  test('the contract list abbreviates only where it stays legible', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')
    // Narrowed to Cargo Handling, whose tarifs are per kg. The Commercial user now
    // sees every line, and Ground Handling's millions legitimately do abbreviate — the
    // property under test is that the small per-kg figures are not swept up with them.
    await page.getByLabel('Saring berdasarkan lini bisnis').selectOption('Cargo Handling')

    const tarifCells = await page.locator('table tbody tr td:nth-child(8)').allInnerTexts()
    expect(tarifCells.length).toBeGreaterThan(0)
    // Cargo tarifs are all four- and five-figure, so none should be abbreviated.
    for (const cell of tarifCells) {
      expect(cell).not.toMatch(/jt|M|T/)
      expect(cell).toMatch(/^Rp [\d.]+$/)
    }
  })
})

test.describe('status banding', () => {
  test('the four bands are distributed as the source data implies', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/kontrak')

    const statuses = await page.locator('table tbody tr td:nth-child(4)').allInnerTexts()
    const counts = statuses.reduce<Record<string, number>>((acc, text) => {
      // The badge carries its rule after an em-dash for screen readers; the band is
      // everything before it.
      const band = text.split('—')[0]!.trim()
      acc[band] = (acc[band] ?? 0) + 1
      return acc
    }, {})

    // The workbook's dates, re-anchored on seed, yield this pipeline.
    expect(counts['Aman']).toBe(9)
    expect(counts['Perlu Perhatian']).toBe(5)
    expect(counts['Kritis']).toBe(3)
    expect(counts['Nonaktif']).toBe(3)
  })

  test('expired contracts are queued apart from the ones still savable', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/kritis')

    await expect(page.getByRole('heading', { name: /Sudah Lewat Tempo/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Kritis/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Perlu Perhatian/ })).toBeVisible()
  })

  test('each queue entry states why it needs attention and what to do', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kritis')

    await expect(page.getByText('Mengapa perlu perhatian:').first()).toBeVisible()
    // The suggested action is derived, so it names a concrete next step.
    const firstEntry = page.locator('li').filter({ hasText: 'Mengapa perlu perhatian:' }).first()
    await expect(firstEntry).toContainText(/Buka simulator|Hubungi pelanggan|Siapkan proposal|Selesaikan kasus|Susun proposal|Konfirmasi apakah/)
  })
})

test.describe('search, filter and sort', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/kontrak')
  })

  test('searching by customer name narrows the list', async ({ page }) => {
    await page.getByLabel('Cari nama pelanggan').fill('Samudera')
    await expect(page.locator('table tbody tr')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Samudera Cold Chain' })).toBeVisible()
  })

  test('filtering by business line narrows the list', async ({ page }) => {
    await page.getByLabel('Saring berdasarkan lini bisnis').selectOption('Ancillary Business')
    await expect(page.locator('table tbody tr')).toHaveCount(5)
  })

  test('filtering by status band narrows the list', async ({ page }) => {
    await page.getByLabel('Saring berdasarkan status').selectOption('Nonaktif')
    await expect(page.locator('table tbody tr')).toHaveCount(3)
  })

  test('filtering by RFM standing narrows the list', async ({ page }) => {
    await page.getByLabel('Saring berdasarkan standing RFM').selectOption('HIGH')
    await expect(page.locator('table tbody tr')).toHaveCount(8)
  })

  test('a search that matches nothing explains itself rather than looking broken', async ({
    page,
  }) => {
    await page.getByLabel('Cari nama pelanggan').fill('tidak ada pelanggan bernama ini')
    await expect(page.getByText('Tidak ada kontrak yang cocok')).toBeVisible()
  })

  test('sorting by margin orders the list by GPM', async ({ page }) => {
    await page.getByRole('button', { name: 'Urutkan berdasarkan GPM' }).click()

    const gpmCells = await page.locator('table tbody tr td:nth-child(9)').allInnerTexts()
    const values = gpmCells.map((text) =>
      Number(/(\d+),(\d+)%/.exec(text)!.slice(1, 3).join('.')),
    )
    expect(values).toEqual([...values].sort((a, b) => a - b))
  })
})
