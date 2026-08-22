import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, FileText, LogOut, Wallet, type LucideIcon } from 'lucide-react'
import type { Route } from 'next'

import { signOut } from '@/app/masuk/actions'
import { landingFor, may, requireCaller, scopeLabel, type Grants } from '@/lib/auth'
import type { Database } from '@/lib/supabase/database.types'

type AppModule = Database['public']['Enums']['app_module']

export const metadata = { title: 'Pilih ruang kerja — Gapura Commercial' }

interface Workspace {
  href: Route
  judul: string
  ringkas: string
  /** Named concretely, so nobody has to click a card to learn what is behind it. */
  isi: string[]
  icon: LucideIcon
  modul: AppModule
}

/**
 * Two ways of working, not two menus.
 *
 * Deliberately outside the `(app)` route group, so the sidebar is not rendered here.
 * A chooser framed by the very navigation it is asking you to choose between answers
 * its own question before it is asked — and the sidebar's contents only make sense
 * once a workspace has been picked.
 *
 * One answers "do we renew this contract", one answers "how is the book performing".
 * They are separated because they are read differently, not because the navigation was
 * getting long.
 *
 * The cards come from `role_module_grants`, the same table the policies read. A card
 * that is offered therefore always leads somewhere the caller can actually be, and a
 * module the caller has no grant for is **not rendered at all** — a disabled tile still
 * announces that something exists and that somebody else is allowed to see it.
 */
const WORKSPACES: readonly Workspace[] = [
  {
    href: '/',
    judul: 'Kontrak Commercial',
    ringkas: 'Semua bahan untuk satu keputusan: diperpanjang atau tidak.',
    isi: ['Kontrak & sisa masa berlaku', 'Segmentasi CRM', 'Simulator P&L', 'Piutang & penalty'],
    icon: FileText,
    modul: 'kontrak',
  },
  {
    href: '/pendapatan',
    judul: 'Pendapatan',
    ringkas: 'RKAP terhadap realisasi, per bulan, per cabang, per lini.',
    isi: ['RKAP vs Aktual', 'Tren bulanan & YoY', 'Produksi', 'Peringkat LoB & bandara'],
    icon: Wallet,
    modul: 'pendapatan',
  },
]

const visibleTo = (grants: Grants): Workspace[] =>
  WORKSPACES.filter((workspace) => may(grants, workspace.modul, 'view'))

export default async function PilihPage() {
  const { profile, grants } = await requireCaller()

  // A GM Cabang has one place to be and never sees this page; landing logic lives in
  // one function so the sign-in redirect and a typed-in URL cannot disagree.
  const landing = landingFor(grants)
  if (landing !== '/pilih') redirect(landing)

  const workspaces = visibleTo(grants)

  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Building2 size={18} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="font-extrabold text-primary">Gapura Commercial</p>
            <p className="text-[10px] text-gray-400">Contract &amp; Margin Engine</p>
          </div>
        </div>
        {/* The only way out of this page. With no sidebar there is no other sign-out. */}
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <LogOut size={16} aria-hidden="true" />
            Keluar
          </button>
        </form>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-8">
        <p className="text-sm text-gray-400">Selamat datang, {profile.nama}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-gray-900">Pilih ruang kerja</h1>
        <p className="mt-2 text-sm text-gray-400">
          Cakupan Anda: {scopeLabel(profile)}. Isi setiap ruang menyesuaikan hak akses Anda.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.href}
            href={workspace.href}
            className="animate-fade-in group flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-primary-light focus-visible:border-primary-light"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <workspace.icon size={20} aria-hidden="true" />
            </div>
            <h2 className="text-base font-bold text-gray-900">{workspace.judul}</h2>
            <p className="mt-1 text-sm text-gray-400">{workspace.ringkas}</p>
            <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-400">
              {workspace.isi.map((baris) => (
                <li key={baris}>{baris}</li>
              ))}
            </ul>
          </Link>
        ))}
      </div>
      </main>
    </div>
  )
}
