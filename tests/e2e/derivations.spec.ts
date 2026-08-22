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

    // Pelita Air: tarif 16.000.000, cost 12.400.000 → 22,5% against a 25% target.
    await page.getByRole('link', { name: 'Pelita Air' }).click()

    await expect(page.getByText('22,5%').first()).toBeVisible()
    await expect(page.getByText('Target GPM Kontrak Ini')).toBeVisible()
    await expect(page.getByText('25,0%').first()).toBeVisible()
    await expect(
      page.getByText(/Kontrak ini berada di bawah target marginnya sendiri/),
    ).toBeVisible()
  })

  test('a contract above its own target carries no breach warning', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Citilink: tarif 18.500.000, cost 14.800.000 → 20,0% against a 20,0% target —
    // meets exactly, so no breach.
    await page.getByRole('link', { name: 'Citilink' }).click()

    await expect(page.getByText('20,0%').first()).toBeVisible()
    await expect(page.getByText(/berada di bawah target marginnya sendiri/)).toHaveCount(0)
  })

  test('the report counts contracts below target for each business line', async ({ page }) => {
    await signIn(page, PERSONAS.vp.email)
    await page.goto('/laporan')

    const dibawahTarget = async (line: string): Promise<string> =>
      (
        await page
          .locator('tr', { has: page.getByRole('rowheader', { name: line, exact: true }) })
          .locator('td')
          .nth(2)
          .innerText()
      ).trim()

    expect(await dibawahTarget('Ground Handling')).toBe('10')
    expect(await dibawahTarget('Ancillary Business')).toBe('1')
    expect(await dibawahTarget('Cargo Handling')).toBe('2')
  })
})

test.describe('Rupiah across three orders of magnitude', () => {
  test('the smallest tarif in the book is not collapsed to zero', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Jogja Flight, Rp 5.200.000, is currently the smallest tarif in the book — still
    // above the compact formatter's 1-juta floor, so it abbreviates on the list, but
    // the detail page always renders it in full.
    await page.getByRole('link', { name: 'Jogja Flight' }).click()

    await expect(page.getByText('Rp 5.200.000')).toBeVisible()
    await expect(page.getByText(/Rp 0,0 jt/)).toHaveCount(0)
  })

  test('a large tarif still renders in full on the detail page', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')

    // Super Air Jet: Rp 13.000.000, the largest tarif among the book's uniquely
    // named customers.
    await page.getByRole('link', { name: 'Super Air Jet' }).click()
    await expect(page.getByText('Rp 13.000.000')).toBeVisible()
  })

  test('the contract list formats an abbreviated tarif sensibly', async ({ page }) => {
    await signIn(page, PERSONAS.commercial.email)
    await page.goto('/kontrak')
    // Cargo Handling now holds a single contract (Rp 11.200.000), large enough that
    // it legitimately abbreviates like every other line's — there is no longer a
    // per-kg-scale Cargo tarif in the book to guard the small-figure case with. What's
    // still worth asserting is that the abbreviation itself renders sanely.
    await page.getByLabel('Saring berdasarkan lini bisnis').selectOption('Cargo Handling')

    const tarifCells = await page.locator('table tbody tr td:nth-child(8)').allInnerTexts()
    expect(tarifCells.length).toBeGreaterThan(0)
    for (const cell of tarifCells) {
      expect(cell).toMatch(/^Rp \d+,\d jt$/)
      expect(cell).not.toMatch(/0,0/)
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

    // The Sheet's own dates, unaltered by seeding, yield this pipeline as of the
    // book's current shape.
    expect(counts['Aman']).toBe(5)
    expect(counts['Perlu Perhatian']).toBe(3)
    expect(counts['Kritis']).toBe(3)
    expect(counts['Nonaktif']).toBe(4)
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
    await page.getByLabel('Cari nama pelanggan').fill('Citilink')
    await expect(page.locator('table tbody tr')).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Citilink' })).toBeVisible()
  })

  test('filtering by business line narrows the list', async ({ page }) => {
    await page.getByLabel('Saring berdasarkan lini bisnis').selectOption('Ancillary Business')
    await expect(page.locator('table tbody tr')).toHaveCount(2)
  })

  test('filtering by status band narrows the list', async ({ page }) => {
    await page.getByLabel('Saring berdasarkan status').selectOption('Nonaktif')
    await expect(page.locator('table tbody tr')).toHaveCount(4)
  })

  test('filtering by RFM standing narrows the list', async ({ page }) => {
    await page.getByLabel('Saring berdasarkan standing RFM').selectOption('HIGH')
    await expect(page.locator('table tbody tr')).toHaveCount(6)
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
