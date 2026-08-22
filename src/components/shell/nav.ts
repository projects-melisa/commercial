import {
  AlertTriangle,
  BarChart2,
  Bell,
  CheckSquare,
  FileClock,
  FileText,
  Gavel,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldAlert,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import type { Route } from 'next'

import type { Grants } from '@/lib/auth'
import type { Database } from '@/lib/supabase/database.types'

type AppModule = Database['public']['Enums']['app_module']
type GrantAction = Database['public']['Enums']['grant_action']

/** Which sidebar an entry belongs to. `global` renders in both. */
export type NavWorkspace = 'kontrak' | 'pendapatan' | 'global'

export interface NavItem {
  href: Route
  label: string
  icon: LucideIcon
  /** The grant this entry needs, or null for the pages everyone signed in may open. */
  grant: readonly [AppModule, GrantAction] | null
  workspace: NavWorkspace
}

/**
 * The sidebar, sourced from the same grant table the RLS policies read.
 *
 * It used to filter on role names — `roles: ['vp']` on the approval queue. That was
 * accurate while there were three roles, and became a liability at nine: every new
 * role either had to be listed by hand in every entry or silently inherited whatever
 * the unlisted default was. Asking for a grant instead means adding a role is one
 * `insert` into `role_module_grants` and no edit here at all.
 *
 * Hiding an entry remains a convenience rather than a control. The page behind it
 * calls `requireGrant` and answers 404, and the database refuses the rows regardless.
 *
 * `workspace` is a second, orthogonal partition — which of the two sidebars (Kontrak
 * or Pendapatan) an entry shows up in. It is a tag on the one list, not a second list:
 * a role's grants still decide *whether* an entry can appear at all, this only decides
 * *where*. An entry nobody remembered to tag would default to nothing, not to the
 * wrong workspace, so getting it wrong is loud rather than a silent scope leak.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, grant: ['kontrak', 'view'], workspace: 'kontrak' },
  { href: '/kontrak', label: 'Kontrak', icon: FileText, grant: ['kontrak', 'view'], workspace: 'kontrak' },
  { href: '/kritis', label: 'Kontrak Kritis', icon: AlertTriangle, grant: ['kontrak', 'view'], workspace: 'kontrak' },
  { href: '/pendapatan', label: 'Pendapatan', icon: Wallet, grant: ['pendapatan', 'view'], workspace: 'pendapatan' },
  { href: '/simulator', label: 'Simulator P&L', icon: TrendingUp, grant: ['simulator', 'view'], workspace: 'kontrak' },
  {
    href: '/persetujuan',
    label: 'Persetujuan',
    icon: CheckSquare,
    grant: ['simulator', 'approve'],
    workspace: 'kontrak',
  },
  { href: '/pelanggan', label: 'Pelanggan', icon: Users, grant: ['crm', 'view'], workspace: 'kontrak' },
  { href: '/piutang', label: 'Piutang', icon: Receipt, grant: ['piutang', 'view'], workspace: 'kontrak' },
  { href: '/penalty', label: 'Penalty', icon: Gavel, grant: ['penalty', 'view'], workspace: 'kontrak' },
  {
    href: '/irregularities',
    label: 'Irregularities',
    icon: ShieldAlert,
    grant: ['irregularities', 'view'],
    workspace: 'kontrak',
  },
  { href: '/audit', label: 'Jejak Audit', icon: FileClock, grant: ['audit', 'view'], workspace: 'kontrak' },
  { href: '/laporan', label: 'Laporan', icon: BarChart2, grant: ['kontrak', 'view'], workspace: 'kontrak' },
  { href: '/notifikasi', label: 'Notifikasi', icon: Bell, grant: ['notifikasi', 'view'], workspace: 'global' },
  {
    href: '/pengguna',
    label: 'Pengguna & Role',
    icon: UsersRound,
    grant: ['pengguna', 'manage'],
    workspace: 'global',
  },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings, grant: null, workspace: 'global' },
]

// The membership test is written out rather than imported from `@/lib/auth`: the
// sidebar is a client component, and that module reaches for the server Supabase
// client, which would drag the service plumbing into the browser bundle.
export const navItemsFor = (grants: Grants, workspace: NavWorkspace): NavItem[] =>
  NAV_ITEMS.filter(
    (item) =>
      (item.workspace === workspace || item.workspace === 'global') &&
      (item.grant === null || grants.has(`${item.grant[0]}:${item.grant[1]}`)),
  )
