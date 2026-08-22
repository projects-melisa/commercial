'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import type { Route } from 'next'

import type { RevenueOptions } from '@/lib/data/revenue'

/**
 * Period, station, customer and line — held in the URL, not in component state.
 *
 * The URL is what makes a filtered view shareable and survivable across a reload, and
 * it keeps the filtering on the server where the data already is.
 *
 * Do not run `pnpm format` over this file: oxfmt 0.2.0 hoists every comment to the top
 * and, on this file, produced a syntax error in the props type.
 */
const Field = ({
  label,
  name,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  name: string
  value: string
  options: { value: string; label: string }[]
  disabled?: boolean
  onChange: (name: string, value: string) => void
}) => (
  <label className="flex min-w-0 flex-col gap-1">
    <span className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
      {label}
      {disabled ? <Lock size={11} aria-hidden="true" /> : null}
    </span>
    <select
      name={name}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(name, event.target.value)}
      className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
)

export const FilterBar = ({
  options,
  tahun,
  cab,
  customer,
  lob,
  lockedCabang,
}: {
  options: RevenueOptions
  tahun: number
  cab: string
  customer: string
  lob: string
  /** The GM Cabang's own station, when the session is confined to one. */
  lockedCabang: string | null
}) => {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const set = (name: string, value: string): void => {
    const next = new URLSearchParams(params.toString())
    if (value === '') next.delete(name)
    else next.set(name, value)
    const query = next.toString()
    router.replace((query ? `${pathname}?${query}` : pathname) as Route, { scroll: false })
  }

  const semua = (label: string) => ({ value: '', label: `Semua ${label}` })
  const asOption = (v: string) => ({ value: v, label: v })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Periode"
          name="tahun"
          value={String(tahun)}
          options={options.tahun.map((y) => ({ value: String(y), label: String(y) }))}
          onChange={set}
        />

        {/* Locked rather than hidden. A GM Cabang whose figures differ from the ones
            quoted in a meeting needs to see why — a control that is missing explains
            nothing, and one that is visibly fixed explains it at a glance. */}
        <Field
          label="Cabang"
          name="cab"
          value={lockedCabang ?? cab}
          disabled={lockedCabang !== null}
          options={
            lockedCabang ? [asOption(lockedCabang)] : [semua('cabang'), ...options.cab.map(asOption)]
          }
          onChange={set}
        />

        <Field
          label="Pelanggan"
          name="customer"
          value={customer}
          options={[semua('pelanggan'), ...options.customer.map(asOption)]}
          onChange={set}
        />
        <Field
          label="Line of Business"
          name="lob"
          value={lob}
          options={[semua('LoB'), ...options.lob.map(asOption)]}
          onChange={set}
        />
      </div>

      {lockedCabang ? (
        <p className="mt-2.5 text-xs text-gray-400">
          Filter cabang terkunci pada {lockedCabang}: hak akses Anda hanya mencakup cabang itu.
        </p>
      ) : null}
    </div>
  )
}
