import {
  AlertTriangle,
  BarChart2,
  Bell,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Settings,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { Route } from 'next'

import type { UserRole } from '@/lib/domain'

export interface NavItem {
  href: Route
  label: string
  icon: LucideIcon
  /** When set, only these roles see the entry. */
  roles?: UserRole[]
}

/**
 * The eight sections carried over from the prototype, plus the VP approval queue.
 *
 * Hiding an entry is a convenience, not a control: the pages themselves re-check the
 * caller's role and the database refuses out-of-scope rows regardless.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kontrak', label: 'Kontrak', icon: FileText },
  { href: '/kritis', label: 'Kontrak Kritis', icon: AlertTriangle },
  { href: '/simulator', label: 'Simulator P&L', icon: TrendingUp },
  { href: '/persetujuan', label: 'Persetujuan', icon: CheckSquare, roles: ['vp'] },
  { href: '/pelanggan', label: 'Pelanggan', icon: Users },
  { href: '/laporan', label: 'Laporan', icon: BarChart2 },
  { href: '/notifikasi', label: 'Notifikasi', icon: Bell },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings },
]

export const navItemsFor = (role: UserRole): NavItem[] =>
  NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))
