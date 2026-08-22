import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Route } from 'next'
import { Download, ExternalLink } from 'lucide-react'

import { LobPanel, LOB_SUBS, type CustomerRfm } from '@/app/(app)/pendapatan/lob-panel'
import { OverviewPanel, OVERVIEW_SUBS } from '@/app/(app)/pendapatan/overview-panel'
import { QnaPanel } from '@/app/(app)/pendapatan/qna-panel'
import { FilterBar } from '@/components/revenue/filter-bar'
import { EmptyState } from '@/components/ui/states'
import { Freshness } from '@/components/freshness'
import { may, requireGrant, scopeLabel } from '@/lib/auth'
import { reportLinkFor } from '@/lib/data/domains'
import {
  applyFilter,
  listRevenue,
  optionsFrom,
  tahunTerbaru,
} from '@/lib/data/revenue'
import { createClient } from '@/lib/supabase/server'

/**
 * The revenue workspace: three tabs, and the sub-tabs that belong to each.
 *
 * Mirrors the client's own Power BI structure — Overview, LoB, Q&A across the top;
 * Revenue, Production, Revenue (UP), Production (UP) beneath Overview. The nesting is
 * not decoration: "Revenue" and "B2C RFM Analysis" are not peers, and a flat strip of
 * six made them look like they were.
 */

interface TopTab {
  slug: string
  label: string
  subs: readonly { slug: string; label: string }[]
}

const TOP_TABS: readonly TopTab[] = [
  { slug: 'overview', label: 'Overview', subs: OVERVIEW_SUBS },
  { slug: 'lob', label: 'LoB', subs: LOB_SUBS },
  { slug: 'qna', label: 'Q&A', subs: [] },
]

const hrefFor = (tab: string, sub?: string): Route =>
  (tab === 'overview' && (sub === undefined || sub === 'revenue')
    ? '/pendapatan'
    : sub
      ? `/pendapatan/${tab}/${sub}`
      : `/pendapatan/${tab}`) as Route

const Tabs = ({
  items,
  active,
  hrefOf,
  label,
  utama,
}: {
  items: readonly { slug: string; label: string }[]
  active: string
  hrefOf: (slug: string) => Route
  label: string
  utama?: boolean
}) => (
  <nav aria-label={label} className="relative overflow-x-auto">
    <ul className={`flex min-w-max gap-1 ${utama ? 'border-b-2 border-gray-200' : ''}`}>
      {items.map((item) => {
        const on = item.slug === active
        return (
          <li key={item.slug}>
            <Link
              href={hrefOf(item.slug)}
              aria-current={on ? 'page' : undefined}
              className={
                utama
                  ? `-mb-0.5 block border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
                      on
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-700'
                    }`
                  : `block rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      on
                        ? 'bg-primary text-white'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                    }`
              }
            >
              {item.label}
            </Link>
          </li>
        )
      })}
    </ul>
  </nav>
)

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? ''

export type RevenueSearchParams = Record<string, string | string[] | undefined>

/**
 * Shared by `/pendapatan`, `/pendapatan/[tab]` and `/pendapatan/[tab]/[sub]`.
 *
 * Three route files over one view rather than a catch-all, because `typedRoutes` does
 * not expand `[[...slug]]` to include the bare path — every `href="/pendapatan"` in the
 * app would have needed a cast, and a cast is how a broken link gets shipped.
 */
export const RevenueView = async ({
  tab: tabSlug,
  sub: subSlug,
  searchParams,
}: {
  tab: string | undefined
  sub: string | undefined
  searchParams: Promise<RevenueSearchParams>
}) => {
  const { profile, grants } = await requireGrant('pendapatan', 'view')
  const query = await searchParams

  // No role name here on purpose (R-1): the grant `report_links:view` decides who is
  // offered this button, the same row the policy reads. Withdrawing it from cabang
  // would be a one-row delete from role_module_grants, not an edit here.
  const powerBiLink = await reportLinkFor('pendapatan')

  const tab = TOP_TABS.find((t) => t.slug === (tabSlug ?? 'overview'))
  if (!tab) notFound()
  const sub = subSlug === undefined ? tab.subs[0] : tab.subs.find((s) => s.slug === subSlug)
  if (sub === undefined && tab.subs.length > 0) notFound()
  if (subSlug !== undefined && tab.subs.length === 0) notFound()

  const semua = await listRevenue()
  if (semua.length === 0) {
    return (
      <EmptyState
        judul="Belum ada data pendapatan dalam cakupan Anda"
        keterangan={`Tidak ada baris Ancillary_Data untuk ${scopeLabel(profile)}. Tarikan harian mengisi tabel ini dari Sheet; bila Sheet-nya masih kosong, halaman ini juga kosong.`}
      />
    )
  }

  const options = optionsFrom(semua)
  const dipilih = Number(first(query.tahun))
  const tahun = options.tahun.includes(dipilih) ? dipilih : tahunTerbaru(semua)

  // The station filter cannot widen a GM Cabang's view — RLS already returned only
  // their rows — but pinning it keeps the control honest about what it is doing.
  const lockedCabang = profile.cabang
  const cab = lockedCabang ?? first(query.cab)
  const customer = first(query.customer)
  const lob = first(query.lob)

  const rows = applyFilter(semua, {
    tahun,
    cab: cab || null,
    customer: customer || null,
    lob: lob || null,
  })

  const overviewSub = OVERVIEW_SUBS.find((s) => s.slug === sub?.slug)
  const lobSub = LOB_SUBS.find((s) => s.slug === sub?.slug)

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Pendapatan {tahun}</h1>
          <p className="mt-1 text-sm text-gray-400">
            {overviewSub
              ? `${overviewSub.ringkas} Sumber: ${overviewSub.sumber}. Cakupan: ${scopeLabel(profile)}.`
              : `Segmentasi pelanggan untuk ${scopeLabel(profile)}.`}
          </p>
        </div>
        {may(grants, 'pendapatan', 'export') ? (
          <a
            href="/api/export/pendapatan"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download size={15} aria-hidden="true" />
            Ekspor CSV
          </a>
        ) : null}
        {powerBiLink ? (
          <a
            href={powerBiLink.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={15} aria-hidden="true" />
            {powerBiLink.judul}
          </a>
        ) : null}
      </header>

      <Freshness tab="Ancillary_Data" />

      <Tabs
        items={TOP_TABS}
        active={tab.slug}
        hrefOf={(slug) => hrefFor(slug)}
        label="Bagian pendapatan"
        utama
      />

      {tab.subs.length > 0 && sub ? (
        <Tabs
          items={tab.subs}
          active={sub.slug}
          hrefOf={(slug) => hrefFor(tab.slug, slug)}
          label={`Sub-bagian ${tab.label}`}
        />
      ) : null}

      <>
          <FilterBar
            options={options}
            tahun={tahun}
            cab={cab}
            customer={customer}
            lob={lob}
            lockedCabang={lockedCabang}
          />

          {rows.length === 0 ? (
            <EmptyState
              judul="Tidak ada baris untuk kombinasi filter ini"
              keterangan="Longgarkan salah satu filter di atas. Ini hasil penyaringan, bukan kegagalan sistem."
            />
          ) : tab.slug === 'qna' ? (
            <QnaPanel
              rows={rows}
              tahun={tahun}
              measure="rupiah"
              jalurRaw={first(query.jalur)}
              basePath="/pendapatan/qna"
              query={
                new URLSearchParams(
                  Object.entries(query).flatMap(([k, v]) =>
                    k === 'jalur' || v === undefined ? [] : [[k, Array.isArray(v) ? (v[0] ?? '') : v]],
                  ),
                )
              }
            />
          ) : overviewSub ? (
            <OverviewPanel sub={overviewSub} rows={rows} tahun={tahun} />
          ) : lobSub ? (
            <LobPanel
              sub={lobSub}
              rows={rows}
              customers={await listCustomerRfm()}
              tahun={tahun}
              lob={lob || 'semua lini'}
            />
          ) : null}

          <p className="text-xs text-gray-400">
            Ambang warna %Ach masih sementara (≥95% · 60–94% · &lt;60%) — belum ada dokumen yang
            menyebut angka potongnya (C-05). Angka pada halaman ini berasal dari data dummy
            <code className="mx-1">Ancillary_Data</code>: total dan turunannya dikalibrasi ke
            tangkapan layar Power BI, sebarannya belum (R-04).
          </p>
      </>
    </div>
  )
}

/** RFM comes from `CRM_Data`, which lands in `customers` — not in the revenue table. */
const listCustomerRfm = async (): Promise<CustomerRfm[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select('customer_id, nama, rfm_status, frequency_score, monetary_score, recency_score, tipe')
    .order('nama')

  return (data ?? []).map((row) => ({
    customerId: row.customer_id,
    nama: row.nama,
    rfmStatus: row.rfm_status,
    frequency: row.frequency_score,
    monetary: row.monetary_score,
    recency: row.recency_score,
    tipe: row.tipe,
  }))
}
