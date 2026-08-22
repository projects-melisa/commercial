import { AppShell } from '@/components/shell/app-shell'
import { requireCaller } from '@/lib/auth'
import { countUnreadNotifications } from '@/lib/data/notifications'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, grants } = await requireCaller()
  const unreadCount = await countUnreadNotifications()

  return (
    <AppShell profile={profile} grants={grants} unreadCount={unreadCount}>
      {children}
    </AppShell>
  )
}
