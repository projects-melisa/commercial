'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeftRight, LogOut, Menu, X } from 'lucide-react'

import { signOut } from '@/app/masuk/actions'
import { navItemsFor, type NavWorkspace } from '@/components/shell/nav'
import type { Grants } from '@/lib/auth'
import { ROLE_LABELS } from '@/lib/domain'
import type { ProfileRow } from '@/lib/supabase/types'

/**
 * The signed-in identity, as shown in the sidebar.
 *
 * Qualified by whatever the profile is actually confined to, and by nothing when it
 * is confined to neither: appending a null would read as "Commercial · null".
 */
const roleLabel = (profile: ProfileRow): string => {
  // Both when a profile is confined on both axes; the policies intersect them, so
  // naming only one would understate how narrow the session actually is.
  const scope = [profile.business_line, profile.cabang].filter(Boolean).join(' · ')
  return scope ? `${ROLE_LABELS[profile.role]} · ${scope}` : ROLE_LABELS[profile.role]
}

export const AppShell = ({
  profile,
  grants,
  unreadCount,
  children,
}: {
  profile: ProfileRow
  grants: Grants
  unreadCount: number
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const workspace: NavWorkspace = pathname.startsWith('/pendapatan') ? 'pendapatan' : 'kontrak'
  const items = navItemsFor(grants, workspace)
  // Written out rather than imported as `hasWorkspaceChoice` from `@/lib/auth`, for the
  // same reason `navItemsFor` writes out its own membership test: that module reaches
  // for the server Supabase client, which a client component cannot bundle.
  const hasWorkspaceChoice = grants.has('kontrak:view') && grants.has('pendapatan:view')

  // showModal() is what moves focus into the drawer and makes the page behind it
  // inert; close() is idempotent, so Escape closing it natively is not a special case.
  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer) return
    if (menuOpen && !drawer.open) drawer.showModal()
    else if (!menuOpen && drawer.open) drawer.close()
  }, [menuOpen])

  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  // Only rendered for a role that actually has two workspaces to switch between —
  // gated on the same predicate as `landingFor`, so nobody sees a link to a chooser
  // that would immediately bounce them back to where they started.
  const workspaceSwitcher = hasWorkspaceChoice ? (
    <div className="mb-2 border-b border-white/10 pb-2">
      <Link
        href="/pilih"
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ArrowLeftRight size={17} aria-hidden="true" />
        <span>Ganti ruang kerja</span>
      </Link>
    </div>
  ) : null

  const nav = (
    <nav aria-label="Navigasi utama" className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {workspaceSwitcher}
      {items.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon size={17} aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.href === '/notifikasi' && unreadCount > 0 ? (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
                <span className="sr-only-text"> notifikasi belum dibaca</span>
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )

  const identity = (
    <div className="border-t border-white/10 p-3">
      <div className="mb-2 rounded-lg bg-white/10 px-3 py-2">
        <p className="truncate text-sm font-semibold text-white">{profile.nama}</p>
        <p className="truncate text-xs text-white/60">{roleLabel(profile)}</p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={17} aria-hidden="true" />
          Keluar
        </button>
      </form>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <a
        href="#konten-utama"
        className="sr-only-text focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Lewati ke konten utama
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <Image src="/logo.png" alt="Gapura" width={144} height={40} priority className="h-8 w-auto brightness-0 invert" />
        </div>
        {nav}
        {identity}
      </aside>

      {/* Mobile drawer. A closed <dialog> is display:none, so it costs no tab stops. */}
      <dialog
        ref={drawerRef}
        className="drawer lg:hidden"
        aria-label="Navigasi utama"
        onClose={() => setMenuOpen(false)}
        // A modal dialog is supposed to close itself on Escape, but the browser routes
        // that through a close watcher that only behaves predictably when the dialog was
        // opened under user activation. Handling the key here makes the escape hatch
        // unconditional; both paths end at the same state, and close() is idempotent.
        onKeyDown={(event) => {
          if (event.key === 'Escape') setMenuOpen(false)
        }}
        onClick={(event) => {
          // Clicks on ::backdrop are dispatched to the dialog itself.
          if (event.target === drawerRef.current) setMenuOpen(false)
        }}
      >
        <div className="flex h-full flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to">
          <div className="flex items-center justify-between px-4 py-4">
            <Image src="/logo.png" alt="Gapura" width={144} height={40} className="h-7 w-auto brightness-0 invert" />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Tutup menu navigasi"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          {nav}
          {identity}
        </div>
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <Image src="/logo.png" alt="Gapura" width={144} height={40} className="h-7 w-auto" />
        </header>

        <main id="konten-utama" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
