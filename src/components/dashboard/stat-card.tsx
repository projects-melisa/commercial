import type { LucideIcon } from 'lucide-react'

export const StatCard = ({
  label,
  value,
  keterangan,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string
  value: string
  keterangan?: string
  icon: LucideIcon
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) => {
  const tones = {
    neutral: 'bg-gray-100 text-gray-600',
    good: 'bg-green-100 text-green-700',
    warn: 'bg-amber-100 text-amber-700',
    bad: 'bg-red-100 text-red-700',
  } as const

  return (
    <div className="card-hover rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</p>
          <p className="mt-1.5 text-2xl font-extrabold text-gray-900">{value}</p>
          {keterangan ? <p className="mt-1 text-xs text-gray-500">{keterangan}</p> : null}
        </div>
        <span className={`shrink-0 rounded-lg p-2 ${tones[tone]}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}
