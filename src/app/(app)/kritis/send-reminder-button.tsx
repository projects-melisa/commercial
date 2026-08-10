'use client'

import { useState, useTransition } from 'react'
import { Bell, Check } from 'lucide-react'

import { sendReminder } from '@/app/(app)/kritis/actions'

export const SendReminderButton = ({ contractId }: { contractId: string }) => {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await sendReminder(contractId))
          })
        }
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary disabled:opacity-50"
      >
        <span className="inline-flex items-center gap-1.5">
          {result ? (
            <Check size={12} aria-hidden="true" />
          ) : (
            <Bell size={12} aria-hidden="true" />
          )}
          {pending ? 'Mengirim…' : 'Kirim Reminder'}
        </span>
      </button>
      {result ? (
        <p role="status" className="mt-1 text-[11px] text-gray-500">
          {result}
        </p>
      ) : null}
    </div>
  )
}
