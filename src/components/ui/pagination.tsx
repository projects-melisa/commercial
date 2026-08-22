'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Client-side pagination over an already-fetched array, 10 rows/page by default. */
export const usePagination = <T,>(items: T[], pageSize = 10) => {
  const [page, setPage] = useState(1)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  // Filtering/sorting upstream can shrink the list out from under the current page.
  useEffect(() => {
    if (page > pageCount) setPage(1)
  }, [page, pageCount])

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  return { page, setPage, pageCount, pageItems, total: items.length }
}

export const Pagination = ({
  page,
  pageCount,
  onPageChange,
  total,
  pageSize = 10,
}: {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  total: number
  pageSize?: number
}) => {
  if (pageCount <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  // Windowed page numbers so a 100-page table doesn't render 100 buttons: first,
  // last, and a small run around the current page, with gaps collapsed to '…'.
  const pages: (number | '…')[] = []
  for (let n = 1; n <= pageCount; n++) {
    if (n === 1 || n === pageCount || Math.abs(n - page) <= 1) pages.push(n)
    else if (pages[pages.length - 1] !== '…') pages.push('…')
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 sm:flex-row">
      <p className="text-xs text-gray-500">
        {start}–{end} dari {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Halaman sebelumnya"
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>
        {pages.map((n, i) =>
          n === '…' ? (
            <span key={`gap-${i}`} className="px-1.5 text-xs text-gray-400">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-current={n === page ? 'page' : undefined}
              className={`min-w-8 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                n === page ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {n}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === pageCount}
          aria-label="Halaman berikutnya"
          className="rounded-lg border border-gray-200 p-1.5 text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
