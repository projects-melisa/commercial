'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, LogOut, Menu, X } from 'lucide-react'

import { signOut } from '@/app/masuk/actions'
import { navItemsFor } from '@/components/shell/nav'
import type { ProfileRow } from '@/lib/supabase/types'

/**
 * The signed-in identity, as shown in the sidebar.
 *
 * A Commercial user with no business line covers all of them, so there is nothing to
 * qualify the role with — appending a null would read as "Commercial · null".
 */
const roleLabel = (profile: ProfileRow): string => {
  if (profile.role === 'vp') return 'VP / Dirut DC'
  return profile.business_line ? `Commercial · ${profile.business_line}` : 'Commercial'
}

export const AppShell = ({
  profile,
  unreadCount,
  children,
}: {
  profile: ProfileRow
  unreadCount: number
  children: React.ReactNode
}) => {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const items = navItemsFor(profile.role)

  const isActive = (href: string): boolean =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const nav = (
    <nav aria-label="Navigasi utama" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
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
      <aside className="sidebar-scroll hidden w-60 shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Building2 size={18} className="text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="font-extrabold text-white">G-CME</p>
            <p className="text-[10px] text-white/60">Contract &amp; Margin Engine</p>
          </div>
        </div>
        {nav}
        {identity}
      </aside>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative flex h-full w-64 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to">
            <div className="flex items-center justify-between px-4 py-4">
              <p className="font-extrabold text-white">G-CME</p>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Tutup menu"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {nav}
            {identity}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <p className="font-extrabold text-primary">G-CME</p>
        </header>

        <main id="konten-utama" className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
