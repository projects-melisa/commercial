import { expect, type Page } from '@playwright/test'

import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../src/lib/demo-accounts.ts'

/**
 * The nine seeded logins, one per role.
 *
 * VP, Commercial and the four KPS units are confined to nothing, so a spec needing a
 * small result set from any of them reaches for a filter rather than an account. The
 * GM Cabang is confined to one station and is the small result set; the super admin
 * is the opposite boundary — signed in, and holding no business data at all.
 */
export const PERSONAS = {
  vp: DEMO_ACCOUNTS.find((a) => a.role === 'vp')!,
  commercial: DEMO_ACCOUNTS.find((a) => a.role === 'commercial_kps')!,
  dirut: DEMO_ACCOUNTS.find((a) => a.role === 'direktur_utama')!,
  cabang: DEMO_ACCOUNTS.find((a) => a.role === 'cabang')!,
  finance: DEMO_ACCOUNTS.find((a) => a.role === 'finance_kps')!,
  op: DEMO_ACCOUNTS.find((a) => a.role === 'op_kps')!,
  os: DEMO_ACCOUNTS.find((a) => a.role === 'os_kps')!,
  ocs: DEMO_ACCOUNTS.find((a) => a.role === 'ocs_kps')!,
  superAdmin: DEMO_ACCOUNTS.find((a) => a.role === 'super_admin')!,
}

/** Contract lines in the whole book — 12 Sheet rows, split one per station. */
export const TOTAL_CONTRACTS = 15

/** The seeded GM Cabang's station. */
export const SCOPED_CABANG = 'CGK'

/**
 * Where each persona lands after signing in.
 *
 * Not one URL for everyone any more: the destination is decided by the caller's
 * grants, because the contract dashboard answers 404 to a GM Cabang and to a super
 * admin. A spec that waited for `/` would hang for two of the nine.
 */
export const LANDING = {
  kps: /\/pilih/,
  cabang: /\/pendapatan/,
  superAdmin: /\/pengguna/,
} as const

/** Signs in through the real form, as a judge opening the demo would. */
export const signIn = async (
  page: Page,
  email: string,
  landing: RegExp = LANDING.kps,
): Promise<void> => {
  await page.goto('/masuk')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('textbox', { name: 'Kata Sandi' }).fill(DEMO_PASSWORD)
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).toHaveURL(landing)
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
