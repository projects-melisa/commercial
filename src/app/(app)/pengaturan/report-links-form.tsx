'use client'

import { useActionState } from 'react'
import { ExternalLink } from 'lucide-react'

import {
  upsertReportLink,
  type ReportLinkActionState,
} from '@/app/(app)/pengaturan/report-links-actions'
import type { Database } from '@/lib/supabase/database.types'

type AppModule = Database['public']['Enums']['app_module']

const EMPTY: ReportLinkActionState = { error: null, ok: null }

export interface ReportLinkRow {
  modul: AppModule
  label: string
  judul: string
  url: string
  aktif: boolean
}

const Feedback = ({ state }: { state: ReportLinkActionState }) =>
  state.error !== null || state.ok !== null ? (
    <p
      role="alert"
      className={`mt-2 text-xs ${state.error ? 'font-semibold text-sem-bad' : 'text-sem-ok'}`}
    >
      {state.error ?? state.ok}
    </p>
  ) : null

const ReportLinkRowForm = ({ row }: { row: ReportLinkRow }) => {
  const [state, action] = useActionState(upsertReportLink, EMPTY)

  return (
    <form action={action} className="rounded-lg border border-gray-200 p-3">
      <input type="hidden" name="modul" value={row.modul} />
      <div className="flex flex-wrap items-end gap-3">
        <span className="min-w-28 text-xs font-bold text-gray-500 uppercase">{row.label}</span>
        <label className="flex flex-1 min-w-40 flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase">Judul tombol</span>
          <input
            name="judul"
            defaultValue={row.judul}
            required
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-[2] min-w-60 flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase">URL</span>
          <input
            name="url"
            type="url"
            defaultValue={row.url}
            required
            placeholder="https://app.powerbi.com/..."
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-1.5 text-xs font-medium text-gray-600">
          <input type="checkbox" name="aktif" value="true" defaultChecked={row.aktif} />
          Aktif
        </label>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
        >
          <ExternalLink size={13} aria-hidden="true" />
          Simpan
        </button>
      </div>
      <Feedback state={state} />
    </form>
  )
}

export const ReportLinksManager = ({ rows }: { rows: ReportLinkRow[] }) => (
  <div className="space-y-3">
    {rows.map((row) => (
      <ReportLinkRowForm key={row.modul} row={row} />
    ))}
  </div>
)
