import { AppShell } from '@/components/shell/app-shell'
import { requireProfile } from '@/lib/auth'
import { countUnreadNotifications } from '@/lib/data/notifications'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile()
  const unreadCount = await countUnreadNotifications()

  return (
    <AppShell profile={profile} unreadCount={unreadCount}>
      {children}
    </AppShell>
  )
}
