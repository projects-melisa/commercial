import type { BusinessLine } from '@/lib/domain'

/**
 * The four seeded logins: one Commercial user per business line plus one VP.
 *
 * The sign-in screen offers these as a picker that fills the credential fields and
 * nothing more. The role a session actually receives comes from the `profiles` row
 * keyed by the authenticated user, so choosing a different entry here cannot grant
 * access the account does not hold.
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
    nama: 'Rizal Pratama',
    role: 'vp',
    businessLine: null,
    keterangan: 'Melihat seluruh 20 kontrak di tiga lini bisnis. Tidak dapat mengubah data.',
  },
  {
    email: 'ground.handling@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'Arief Budiman',
    role: 'commercial',
    businessLine: 'Ground Handling',
    keterangan: 'Hanya melihat 8 kontrak Ground Handling.',
  },
  {
    email: 'cargo@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'Sari Dewi',
    role: 'commercial',
    businessLine: 'Cargo & Warehouse',
    keterangan: 'Hanya melihat 7 kontrak Cargo & Warehouse.',
  },
  {
    email: 'ancillary@gapura.test',
    password: DEMO_PASSWORD,
    nama: 'Hendra Wijaya',
    role: 'commercial',
    businessLine: 'Ancillary Business',
    keterangan: 'Hanya melihat 5 kontrak Ancillary Business.',
  },
]

export const demoAccountByEmail = (email: string): DemoAccount | undefined =>
  DEMO_ACCOUNTS.find((account) => account.email === email)
