'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { formatMeasure, formatRupiah, formatTanggal } from '@/lib/domain'
import type { RevenueRow } from '@/lib/data/revenue-pure'

/**
 * The revenue drill-down: unlike the entity dialog (`components/ui/drill-down.tsx`),
 * a revenue chart point or table cell is not one entity with a chain of joins to
 * follow — it is a sum, and the only thing worth showing underneath it is the exact
 * `Ancillary_Data` rows that sum into it. One flat table, no further hop.
 */
const RevenueDialog = ({
  open,
  title,
  subtitle,
  rows,
  onClose,
}: {
  open: boolean
  title: string
  subtitle?: string
  rows: RevenueRow[]
  onClose: () => void
}) => {
  const ref = useRef<HTMLDialogElement>(null)

  if (typeof document === 'undefined') return null

  if (ref.current) {
    if (open && !ref.current.open) ref.current.showModal()
    if (!open && ref.current.open) ref.current.close()
  }

  const total = rows.reduce((sum, r) => sum + Number(r.total), 0)
  const production = rows.reduce((sum, r) => sum + Number(r.production), 0)

  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto max-h-[85vh] w-[min(640px,94vw)] rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold text-gray-900">{title}</h2>
          <p className="truncate text-xs text-gray-500">
            {subtitle ? `${subtitle} · ` : ''}
            {rows.length} baris · {formatRupiah(total)} · {formatMeasure('unit', production)} unit
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md bg-gray-800 p-1.5 text-white hover:bg-gray-700"
          aria-label="Tutup"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(85vh-57px)] overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">Tidak ada baris Ancillary_Data untuk titik ini.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-gray-50 text-[11px] tracking-wide text-gray-500 uppercase">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Tanggal</th>
                <th scope="col" className="px-3 py-2 font-semibold">Cabang</th>
                <th scope="col" className="px-3 py-2 font-semibold">Pelanggan</th>
                <th scope="col" className="px-3 py-2 font-semibold">Plan/Actual</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Produksi</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{formatTanggal(r.periode)}</td>
                  <td className="px-3 py-1.5 text-gray-600">{r.cab}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-900">{r.customer}</td>
                  <td className="px-3 py-1.5 text-gray-600">{r.plan_actual}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-700">
                    {formatMeasure('unit', Number(r.production))}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900">
                    {formatRupiah(Number(r.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </dialog>,
    document.body,
  )
}

export const useRevenueDrillDown = () => {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<RevenueRow[]>([])

  const show = (t: string, r: RevenueRow[], s?: string) => {
    setTitle(t)
    setSubtitle(s)
    setRows(r)
    setOpen(true)
  }

  const dialog = (
    <RevenueDialog open={open} title={title} subtitle={subtitle} rows={rows} onClose={() => setOpen(false)} />
  )

  return { show, dialog }
}
