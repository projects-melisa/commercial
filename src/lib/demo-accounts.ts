import type { BusinessLine } from '@/lib/domain'

/**
 * The two seeded logins, one per role.
 *
 * The sign-in screen offers these as a picker that fills the credential fields and
 * nothing more. The role a session actually receives comes from the `profiles` row
 * keyed by the authenticated user, so choosing a different entry here cannot grant
 * access the account does not hold.
 *
 * There are two roles and therefore two accounts. Nobody is invented: the profiles are
 * named for the role they hold rather than for a person who does not exist, which
 * keeps the screen consistent with the rule that nothing shown is made up.
 *
 * The Commercial account carries no business line, which the policies read as "every
 * line": one Commercial user doing for all three lines what three line-scoped users
 * used to do for one each. The policies can still confine a Commercial user to a
 * single line — seeding one with a `businessLine` set is all it takes — but no seeded
 * account is confined, so the demo no longer shows one line being hidden from another.
 */
export interface DemoAccount {
  email: string
  password: string
  nama: string
  role: 'vp' | 'commercial'
  businessLine: BusinessLine | null
  /** What this persona demonstrates, shown beside the picker entry. */
  keterangan: string
}

export const DEMO_PASSWORD = 'Gapura2026!'

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'vp@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'VP',
    role: 'vp',
    businessLine: null,
    keterangan: 'Melihat seluruh 20 kontrak di tiga lini bisnis. Tidak dapat mengubah data.',
  },
  {
    email: 'commercial@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'Commercial',
    role: 'commercial',
    businessLine: null,
    keterangan: 'Mengelola kontrak di seluruh lini bisnis, termasuk mengubah dan mensimulasikan.',
  },
]

export const demoAccountByEmail = (email: string): DemoAccount | undefined =>
  DEMO_ACCOUNTS.find((account) => account.email === email)

/**
 * How a demo account is named on the sign-in screen: by its role, and nothing else.
 *
 * The business line is deliberately absent here. It is a scope within the Commercial
 * role rather than a role of its own, and naming it on the picker made the screen read
 * as though there were more than two kinds of user.
 */
export const demoAccountLabel = (account: DemoAccount): string =>
  account.role === 'vp' ? 'VP' : 'Commercial'
