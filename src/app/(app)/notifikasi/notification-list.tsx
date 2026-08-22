'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCheck, Info, TriangleAlert } from 'lucide-react'

import { markAllRead, markRead } from '@/app/(app)/notifikasi/actions'
import { Drillable } from '@/components/ui/drill-down'
import type { NotificationRow, NotificationSeverity } from '@/lib/supabase/types'

const SEVERITY = {
  critical: { label: 'Kritis', icon: AlertTriangle, className: 'bg-red-100 text-red-700' },
  warning: { label: 'Peringatan', icon: TriangleAlert, className: 'bg-amber-100 text-amber-700' },
  info: { label: 'Informasi', icon: Info, className: 'bg-blue-100 text-blue-700' },
} as const

export const NotificationList = ({ notifications }: { notifications: NotificationRow[] }) => {
  const [severity, setSeverity] = useState<NotificationSeverity | 'all'>('all')
  const [pending, startTransition] = useTransition()

  const visible = notifications.filter((n) => severity === 'all' || n.severity === severity)
  const unread = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Saring berdasarkan tingkat">
          {(['all', 'critical', 'warning', 'info'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeverity(value)}
              aria-pressed={severity === value}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                severity === value
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:border-primary'
              }`}
            >
              {value === 'all' ? 'Semua' : SEVERITY[value].label}
            </button>
          ))}
        </div>

        {unread > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => markAllRead())}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <CheckCheck size={14} aria-hidden="true" />
            Tandai semua dibaca
          </button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
          Tidak ada notifikasi pada tingkat ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((notification) => {
            const meta = SEVERITY[notification.severity]
            const Icon = meta.icon
            return (
              <li
                key={notification.id}
                className={`rounded-xl border p-4 ${
                  notification.read ? 'border-gray-200 bg-white' : 'border-primary/30 bg-green-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 rounded-lg p-2 ${meta.className}`}>
                    <Icon size={15} aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <Drillable kind="notification" id={notification.id} className="block w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{notification.title}</p>
                        {!notification.read ? (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                            BARU
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{notification.body}</p>
                    </Drillable>

                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {notification.contract_id ? (
                        <Link
                          href={`/kontrak/${notification.contract_id}`}
                          onClick={() => {
                            if (!notification.read) {
                              startTransition(() => markRead(notification.id))
                            }
                          }}
                          className="font-semibold text-primary hover:text-primary-light"
                        >
                          Buka kontrak terkait
                        </Link>
                      ) : null}
                      {!notification.read ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => startTransition(() => markRead(notification.id))}
                          className="font-semibold text-gray-500 hover:text-primary disabled:opacity-50"
                        >
                          Tandai dibaca
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
