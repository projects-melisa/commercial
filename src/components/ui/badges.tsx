import { ArrowDown, ArrowUp } from 'lucide-react'

import {
  formatPercent,
  formatPercentagePoints,
  type MarginHealth,
  type RfmStatus,
  type StatusBand,
} from '@/lib/domain'

const STATUS_STYLES: Record<StatusBand, { badge: string; dot: string; keterangan: string }> = {
  Aman: {
    badge: 'badge-aman',
    dot: 'bg-green-600',
    keterangan: 'lebih dari 60 hari tersisa',
  },
  'Perlu Perhatian': {
    badge: 'badge-warning',
    dot: 'bg-amber-600',
    keterangan: '15 sampai 60 hari tersisa',
  },
  Kritis: {
    badge: 'badge-kritis',
    dot: 'bg-red-600',
    keterangan: '14 hari atau kurang tersisa',
  },
  Nonaktif: {
    badge: 'badge-nonaktif',
    dot: 'bg-gray-500',
    keterangan: 'sudah melewati tanggal berakhir',
  },
}

/**
 * The status band. The dot repeats the colour, and the visually hidden text repeats
 * the meaning, so the band is not carried by colour alone.
 */
export const StatusBadge = ({ status }: { status: StatusBand }) => {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {status}
      <span className="sr-only-text">— {style.keterangan}</span>
    </span>
  )
}

const RFM_STYLES: Record<RfmStatus, { className: string; label: string }> = {
  HIGH: { className: 'bg-green-100 text-green-800', label: 'Nilai pelanggan tinggi' },
  MEDIUM: { className: 'bg-blue-100 text-blue-800', label: 'Nilai pelanggan menengah' },
  LOW: { className: 'bg-gray-100 text-gray-700', label: 'Nilai pelanggan rendah' },
}

export const RfmBadge = ({ status }: { status: RfmStatus }) => {
  const style = RFM_STYLES[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      {status}
      <span className="sr-only-text"> — {style.label}</span>
    </span>
  )
}

/**
 * GPM against the contract's own Min_GPM_Target, never against a generic threshold.
 * The arrow and the wording both state which side of the target the contract sits on.
 */
export const GpmIndicator = ({ margin }: { margin: MarginHealth }) => {
  const meets = margin.meetsTarget
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold ${
        meets ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      {meets ? <ArrowUp size={10} aria-hidden="true" /> : <ArrowDown size={10} aria-hidden="true" />}
      {formatPercent(margin.gpm)}
      <span className="sr-only-text">
        {meets ? ' memenuhi ' : ' di bawah '} target {formatPercent(margin.target)}
      </span>
    </span>
  )
}

/** GPM stated relative to target, for places where the gap matters more than the level. */
export const GpmVsTarget = ({ margin }: { margin: MarginHealth }) => (
  <span
    className={`text-xs font-semibold ${margin.meetsTarget ? 'text-green-700' : 'text-red-700'}`}
  >
    {formatPercentagePoints(margin.delta)}
    <span className="sr-only-text">
      {' '}
      terhadap target {formatPercent(margin.target)} —{' '}
      {margin.meetsTarget ? 'memenuhi target' : 'di bawah target'}
    </span>
  </span>
)
