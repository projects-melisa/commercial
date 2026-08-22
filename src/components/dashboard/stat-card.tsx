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

/**
 * The headline figures at the top of the dashboard.
 *
 * Distinct from `StatCard` on purpose: this one leads with the number at display size
 * and carries a coloured rail, because four of them sit alone above the fold and are
 * read from across a room during a review. `StatCard` stays the workhorse for the
 * six-across rows on the module pages, where that treatment would shout.
 *
 * The rail is never the only signal — the tone is also in the icon chip and the
 * wording underneath.
 */
export const MetricCard = ({
  label,
  value,
  keterangan,
  icon: Icon,
  tone = 'neutral',
  delay = 0,
}: {
  label: string
  value: string
  keterangan?: string
  icon: LucideIcon
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
  /** Milliseconds into the page-load stagger. */
  delay?: number
}) => {
  const tones = {
    neutral: { rail: 'bg-primary', chip: 'bg-primary/10 text-primary', value: 'text-gray-900' },
    good: { rail: 'bg-green-600', chip: 'bg-green-100 text-sem-ok', value: 'text-gray-900' },
    warn: { rail: 'bg-amber-500', chip: 'bg-amber-100 text-sem-warn', value: 'text-sem-warn' },
    bad: { rail: 'bg-red-600', chip: 'bg-red-100 text-sem-bad', value: 'text-sem-bad' },
  } as const
  const style = tones[tone]

  return (
    <div
      className="card-hover dash-rise relative overflow-hidden rounded-xl border border-gray-200 bg-white pl-4 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute inset-y-0 left-0 w-1.5 ${style.rail}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.08em] text-gray-500 uppercase">{label}</p>
          <p className={`mt-2 text-3xl leading-none font-extrabold tabular-nums ${style.value}`}>
            {value}
          </p>
          {keterangan ? <p className="mt-2 text-xs text-gray-500">{keterangan}</p> : null}
        </div>
        <span className={`shrink-0 rounded-xl p-2.5 ${style.chip}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}
