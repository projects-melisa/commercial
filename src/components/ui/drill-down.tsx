'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronRight, X } from 'lucide-react'

import { fetchDetail } from '@/app/(app)/detail-actions'
import type { DetailRef, EntityDetail, EntityKind } from '@/lib/data/detail'

export type { DetailRef }

/**
 * The one drill-down surface for the whole app: click any data point, get a dialog
 * with everything about it, and every reference inside it (customer, contract,
 * penalty, …) is itself clickable — the stack is the breadcrumb back through the
 * chain of joins.
 */
const DetailDialog = ({
  open,
  stack,
  loading,
  onClose,
  onBack,
  onFollow,
}: {
  open: boolean
  stack: EntityDetail[]
  loading: boolean
  onClose: () => void
  onBack: () => void
  onFollow: (kind: EntityKind, id: string) => void
}) => {
  const ref = useRef<HTMLDialogElement>(null)
  const current = stack[stack.length - 1]

  // The portal can only mount once we're in the browser. Gating on an effect rather
  // than on `typeof document` keeps the first client render identical to the server
  // render (both skip it), so hydration never has a mismatch to reconcile — the
  // portal appears a tick later instead.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  // Keep the native <dialog> mounted and imperatively opened/closed, rather than
  // conditionally rendering it, so showModal()'s focus trap and Esc-to-close keep
  // working exactly as the platform defines them.
  if (ref.current) {
    if (open && !ref.current.open) ref.current.showModal()
    if (!open && ref.current.open) ref.current.close()
  }

  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto max-h-[85vh] w-[min(560px,92vw)] rounded-xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-black/50"
    >
      {/* Breadcrumb: the full chain of joins followed to get here, so a user three
          hops deep (contract → customer → penalty) can see and retrace the path
          rather than relying on memory of one "back" arrow. */}
      {stack.length > 1 ? (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-xs text-gray-500">
          {stack.map((s, i) => (
            <span key={i} className="flex shrink-0 items-center gap-1">
              {i > 0 ? <ChevronRight size={11} className="shrink-0 text-gray-300" aria-hidden="true" /> : null}
              <span className={i === stack.length - 1 ? 'font-semibold text-gray-700' : ''}>{s.title}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        {stack.length > 1 ? (
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1 rounded-md bg-gray-800 px-2 py-1.5 text-xs font-semibold text-white hover:bg-gray-700"
            aria-label="Kembali"
          >
            <ArrowLeft size={14} />
            Kembali
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-extrabold text-gray-900">{current?.title ?? 'Memuat…'}</h2>
          {current?.subtitle ? <p className="truncate text-xs text-gray-500">{current.subtitle}</p> : null}
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

      <div className="max-h-[calc(85vh-90px)] overflow-y-auto px-4 py-4">
        {loading || !current ? (
          <div className="animate-pulse space-y-4" aria-live="polite" aria-busy="true">
            <div className="h-3 w-24 rounded bg-gray-200" />
            <div className="h-16 rounded-lg bg-gray-100" />
            <div className="h-3 w-32 rounded bg-gray-200" />
            <div className="h-9 rounded-lg bg-gray-100" />
            <div className="h-9 rounded-lg bg-gray-100" />
          </div>
        ) : current.sections.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Tidak ada data.</p>
        ) : (
          <div className="space-y-5">
            {current.sections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-2 text-xs font-bold tracking-wide text-gray-500 uppercase">{section.title}</h3>
                {section.fields && section.fields.length > 0 ? (
                  <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50">
                    {section.fields.map((f, i) => (
                      <div key={`${f.label}-${i}`} className="flex gap-3 px-3 py-2 text-sm">
                        <dt className="w-32 shrink-0 text-gray-500">{f.label}</dt>
                        <dd className="min-w-0 flex-1 font-medium text-gray-900">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {section.refs && section.refs.length > 0 ? (
                  <ul className={section.fields && section.fields.length > 0 ? 'mt-2 space-y-1.5' : 'space-y-1.5'}>
                    {section.refs.map((r) => (
                      <li key={`${r.kind}-${r.id}`}>
                        <button
                          type="button"
                          onClick={() => onFollow(r.kind, r.id)}
                          className="group flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-gray-900 shadow-sm hover:border-primary hover:bg-primary/5"
                        >
                          <span className="min-w-0 truncate">{r.label}</span>
                          <ChevronRight
                            size={16}
                            className="shrink-0 text-gray-400 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : section.fields && section.fields.length === 0 ? (
                  <p className="text-xs text-gray-400">Tidak ada.</p>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </div>
    </dialog>,
    document.body,
  )
}

/**
 * Drives one drill-down dialog. Exported so a chart — which shows an aggregate, not
 * one entity — can seed the stack locally with `startList` (the bucket's members, no
 * fetch needed since the page already holds them) and let the user drill from there
 * into a real entity exactly as `start` does for a table row.
 */
export const useDrillDown = () => {
  const [open, setOpen] = useState(false)
  const [stack, setStack] = useState<EntityDetail[]>([])
  const [loading, setLoading] = useState(false)

  const push = async (kind: EntityKind, id: string) => {
    setLoading(true)
    try {
      const detail = await fetchDetail(kind, id)
      setStack((s) => [...s, detail])
    } finally {
      setLoading(false)
    }
  }

  const start = (kind: EntityKind, id: string) => {
    setStack([])
    setOpen(true)
    void push(kind, id)
  }

  const startList = (title: string, sectionTitle: string, refs: DetailRef[]) => {
    setStack([{ title, sections: [{ title: sectionTitle, refs }] }])
    setOpen(true)
  }

  const dialog = (
    <DetailDialog
      open={open}
      stack={stack}
      loading={loading}
      onClose={() => setOpen(false)}
      onBack={() => setStack((s) => s.slice(0, -1))}
      onFollow={(kind, id) => void push(kind, id)}
    />
  )

  return { start, startList, dialog }
}

/** Wraps a table row: click anywhere on it to open the drill-down for `kind`/`id`. */
export const DrillRow = ({
  kind,
  id,
  className,
  children,
}: {
  kind: EntityKind
  id: string
  className?: string
  children: ReactNode
}) => {
  const { start, dialog } = useDrillDown()
  return (
    <>
      <tr
        onClick={() => start(kind, id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') start(kind, id)
        }}
        role="button"
        tabIndex={0}
        className={`cursor-pointer hover:bg-gray-50 ${className ?? ''}`}
      >
        {children}
      </tr>
      {dialog}
    </>
  )
}

/** Wraps any inline element (a chart legend entry, a card, a label) as a drill-down trigger. */
export const Drillable = ({
  kind,
  id,
  className,
  children,
}: {
  kind: EntityKind
  id: string
  className?: string
  children: ReactNode
}) => {
  const { start, dialog } = useDrillDown()
  return (
    <>
      <button
        type="button"
        onClick={() => start(kind, id)}
        className={`cursor-pointer rounded-lg bg-white text-left text-gray-900 hover:bg-gray-50 ${className ?? ''}`}
      >
        {children}
      </button>
      {dialog}
    </>
  )
}
