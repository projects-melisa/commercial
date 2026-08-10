'use client'

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react'

/**
 * The three states a remote-data screen can be in besides showing data. All three
 * became reachable only once the data moved out of the bundle and onto a server.
 */

export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`skeleton rounded ${className}`} aria-hidden="true" />
)

export const TableSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="space-y-2" role="status" aria-label="Memuat data">
    <span className="sr-only-text">Memuat data…</span>
    {Array.from({ length: rows }, (_, i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
)

export const CardSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-5" role="status" aria-label="Memuat">
    <span className="sr-only-text">Memuat…</span>
    <Skeleton className="mb-3 h-3 w-24" />
    <Skeleton className="h-7 w-32" />
  </div>
)

/**
 * Shown when a query genuinely returned nothing, so an empty scope is never mistaken
 * for a failure.
 */
export const EmptyState = ({
  judul,
  keterangan,
  action,
}: {
  judul: string
  keterangan: string
  action?: React.ReactNode
}) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
    <Inbox className="mb-3 text-gray-400" size={32} aria-hidden="true" />
    <p className="text-sm font-semibold text-gray-900">{judul}</p>
    <p className="mt-1 max-w-sm text-sm text-gray-500">{keterangan}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
)

/** Shown when something failed, always with a way to try again. */
export const ErrorState = ({
  judul = 'Gagal memuat data',
  keterangan,
  onRetry,
}: {
  judul?: string
  keterangan: string
  onRetry: () => void
}) => (
  <div
    role="alert"
    className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center"
  >
    <AlertTriangle className="mb-3 text-red-500" size={32} aria-hidden="true" />
    <p className="text-sm font-semibold text-red-900">{judul}</p>
    <p className="mt-1 max-w-sm text-sm text-red-700">{keterangan}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
    >
      <RefreshCw size={14} aria-hidden="true" />
      Coba lagi
    </button>
  </div>
)
