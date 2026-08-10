import { expect, type Page } from '@playwright/test'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../src/lib/demo-accounts.ts'

export const PERSONAS = {
  vp: DEMO_ACCOUNTS.find((a) => a.role === 'vp')!,
  groundHandling: DEMO_ACCOUNTS.find((a) => a.businessLine === 'Ground Handling')!,
  cargo: DEMO_ACCOUNTS.find((a) => a.businessLine === 'Cargo & Warehouse')!,
  ancillary: DEMO_ACCOUNTS.find((a) => a.businessLine === 'Ancillary Business')!,
}

/** Signs in through the real form, as a judge opening the demo would. */
export const signIn = async (page: Page, email: string): Promise<void> => {
  await page.goto('/masuk')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata Sandi').fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Masuk' }).click()
  await expect(page).toHaveURL(/\/$|\/kontrak/)
}

export const signOut = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Keluar' }).click()
  await expect(page).toHaveURL(/\/masuk/)
}

/** The contract rows currently rendered in the table. */
export const contractRowCount = async (page: Page): Promise<number> =>
  page.locator('table tbody tr').count()

/**
 * Sets a range input's value.
 *
 * Playwright's `fill` refuses a range input, and dragging it cannot land on an exact
 * figure. React tracks the value on the DOM node, so the native setter has to be
 * called directly for the change to be seen.
 */
export const setSlider = async (
  locator: ReturnType<Page['getByLabel']>,
  value: number,
): Promise<void> => {
  await locator.evaluate((element, target) => {
    const input = element as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )!.set!
    setter.call(input, String(target))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

/**
 * Clicks a control that only works once React has hydrated.
 *
 * The button is server-rendered before its handler is attached, so a fast click can
 * land on markup that is not yet interactive. Retrying until the expected result
 * appears is what makes this reliable.
 */
export const clickWhenReady = async (
  page: Page,
  buttonName: string,
  expectation: () => Promise<void>,
): Promise<void> => {
  await expect(async () => {
    await page.getByRole('button', { name: buttonName }).click({ timeout: 2_000 })
    await expectation()
  }).toPass({ timeout: 20_000 })
}
