import { Bell } from 'lucide-react'

import { NotificationList } from '@/app/(app)/notifikasi/notification-list'
import { EmptyState } from '@/components/ui/states'
import { listNotifications } from '@/lib/data/notifications'

export const metadata = { title: 'Notifikasi — Gapura Commercial' }

export default async function NotifikasiPage() {
  const notifications = await listNotifications()
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-gray-900 sm:text-2xl">
          <Bell className="text-primary" size={22} aria-hidden="true" />
          Pusat Notifikasi
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {notifications.length} notifikasi, {unread} belum dibaca.
        </p>
      </header>

      {notifications.length === 0 ? (
        <EmptyState
          judul="Belum ada notifikasi"
          keterangan="Peringatan kontrak dan keputusan skenario akan muncul di sini."
        />
      ) : (
        <NotificationList notifications={notifications} />
      )}
    </div>
  )
}
