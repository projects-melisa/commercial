// Relative, not `@/lib/domain`: the seed generator and the RLS suite import this file
// directly under tsx and vitest, neither of which resolves the tsconfig alias at
// runtime. It mattered only once this stopped being a type-only import.
import { ROLE_LABELS, type BusinessLine, type UserRole } from './domain'

/**
 * The three seeded logins, one per role.
 *
 * The sign-in screen offers these as a picker that fills the credential fields and
 * nothing more. The role a session actually receives comes from the `profiles` row
 * keyed by the authenticated user, so choosing a different entry here cannot grant
 * access the account does not hold.
 *
 * Nobody is invented: the profiles are named for the role they hold rather than for a
 * person who does not exist, which keeps the screen consistent with the rule that
 * nothing shown is made up.
 *
 * VP and Commercial carry neither a business line nor a station, which the policies
 * read as "every line, every station": one Commercial user doing for all three lines
 * what three line-scoped users used to do for one each.
 *
 * The GM Cabang account is the scoped one. It holds the same authority as Commercial
 * and is confined to Soekarno-Hatta, so signing in as it is what shows a boundary
 * being enforced: the three contract lines at CGK arrive, along with the six the
 * Sheet marks "All Station" and which therefore belong to every airport, while the
 * six lines held only by other stations never reach the session.
 */
export interface DemoAccount {
  email: string
  password: string
  nama: string
  role: UserRole
  businessLine: BusinessLine | null
  /** IATA code of the station this account is confined to; null covers all of them. */
  cabang: string | null
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
    cabang: null,
    keterangan: 'Melihat seluruh 20 kontrak di tiga lini bisnis. Tidak dapat mengubah data.',
  },
  {
    email: 'commercial@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'Commercial',
    role: 'commercial',
    businessLine: null,
    cabang: null,
    keterangan: 'Mengelola kontrak di seluruh lini bisnis, termasuk mengubah dan mensimulasikan.',
  },
  {
    email: 'cabang.cgk@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'GM Cabang CGK',
    role: 'cabang',
    businessLine: null,
    cabang: 'CGK',
    keterangan:
      'Wewenang sama dengan Commercial, tetapi hanya untuk Cabang CGK — 9 baris kontrak (3 di CGK, 6 "All Station"); 6 baris milik cabang lain tidak terkirim ke sesi ini.',
  },
]

export const demoAccountByEmail = (email: string): DemoAccount | undefined =>
  DEMO_ACCOUNTS.find((account) => account.email === email)

/**
 * How a demo account is named on the sign-in screen: by its role, plus the station
 * when it has one.
 *
 * The business line is deliberately absent. It is a scope within a role rather than a
 * role of its own, and naming it on the picker made the screen read as though there
 * were more kinds of user than there are. A station is named because it is the whole
 * point of the role that carries it.
 */
export const demoAccountLabel = (account: DemoAccount): string =>
  account.cabang ? `${ROLE_LABELS[account.role]} · ${account.cabang}` : ROLE_LABELS[account.role]
