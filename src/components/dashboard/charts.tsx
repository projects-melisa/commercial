'use client'

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChevronRight } from 'lucide-react'

import { useDrillDown, type DetailRef } from '@/components/ui/drill-down'
import type { StatusBand } from '@/lib/domain'

export const STATUS_COLORS: Record<StatusBand, string> = {
  Aman: '#16a34a',
  'Perlu Perhatian': '#d97706',
  Kritis: '#dc2626',
  Nonaktif: '#6b7280',
}

const AXIS = { fontSize: 11, fill: '#6b7280' }

type Bucket = { name: string; value: number; items?: DetailRef[] }

/**
 * The donut's legend, rendered from the data rather than by Recharts.
 *
 * Two things needed fixing and both live here: Recharts sorts its own legend
 * alphabetically — so it read in a different order from the sectors it labels, and v3
 * no longer accepts a `payload` override — and it colours each label with the series
 * colour, which puts amber at 3.19:1 and green at 3.3:1 on white. The swatch carries
 * the colour; the label is body grey.
 *
 * Each entry is also the click target for its slice: the plot itself stays `inert`
 * (see `ChartFrame`), so the legend is the one real, focusable surface a slice has.
 */
const StatusLegend = ({
  data,
  onSelect,
}: {
  data: { name: StatusBand; value: number; items: DetailRef[] }[]
  onSelect: (bucket: Bucket) => void
}) => (
  <ul className="flex flex-wrap justify-center gap-x-2 gap-y-1.5 text-[11px] text-gray-700">
    {data.map((d) => (
      <li key={d.name}>
        <button
          type="button"
          onClick={() => onSelect(d)}
          disabled={d.value === 0}
          className="flex items-center gap-1.5 rounded-full bg-gray-50 py-1 pr-2 pl-1.5 font-medium hover:bg-gray-100 disabled:cursor-default disabled:opacity-60 disabled:hover:bg-gray-50"
        >
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: STATUS_COLORS[d.name] }} />
          {d.name} ({d.value})
        </button>
      </li>
    ))}
  </ul>
)

/**
 * Recharts' mount animation is JS-driven, so the reduced-motion block in globals.css
 * cannot reach it. Four charts sweeping in on every page load is scattered motion
 * rather than one authored moment, so it is off everywhere instead of conditionally.
 */
const STILL = { isAnimationActive: false } as const

/**
 * Every chart is paired with a table or list elsewhere on the page, and each carries
 * a text summary for assistive technology, so no figure exists only as a picture.
 *
 * The plot is `inert`, not merely `aria-hidden`: Recharts puts `tabindex="0"` on its
 * surface and pie layers, which under aria-hidden alone became tab stops that
 * announce nothing.
 */
const ChartFrame = ({
  judul,
  ringkasan,
  tinggi = 224,
  legend,
  children,
}: {
  judul: string
  ringkasan: string
  tinggi?: number
  /** The real, focusable stand-in for "click the bar" — rendered outside the inert plot. */
  legend?: React.ReactNode
  children: React.ReactNode
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <h2 className="mb-4 text-sm font-bold text-gray-900">{judul}</h2>
    <p className="sr-only-text">{ringkasan}</p>
    <div className="w-full" style={{ height: tinggi }} aria-hidden="true" inert>
      {children}
    </div>
    {legend}
  </section>
)

/**
 * A bucket list under a bar chart: the plot stays inert (see `ChartFrame`), so this is
 * the real, clickable stand-in for "click the bar" — same bucket, same colour, and the
 * one surface a keyboard or screen-reader user can actually reach.
 */
const BucketList = ({ data, onSelect }: { data: Bucket[]; onSelect: (bucket: Bucket) => void }) => (
  <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
    {data.map((d) => (
      <li key={d.name}>
        <button
          type="button"
          onClick={() => onSelect(d)}
          disabled={d.value === 0}
          className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
        >
          <span className="min-w-0 truncate font-medium text-gray-700">{d.name}</span>
          <span className="flex shrink-0 items-center gap-1">
            <span className="font-bold text-gray-900 tabular-nums">{d.value}</span>
            <ChevronRight size={13} className="text-gray-300 group-hover:text-primary" aria-hidden="true" />
          </span>
        </button>
      </li>
    ))}
  </ul>
)

export const StatusDonut = ({
  data,
}: {
  data: { name: StatusBand; value: number; items: DetailRef[] }[]
}) => {
  const { startList, dialog } = useDrillDown()
  return (
    <ChartFrame
      judul="Sebaran Status Kontrak"
      ringkasan={data.map((d) => `${d.name}: ${d.value} kontrak`).join('. ')}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} {...STILL}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
          <Legend
            content={
              <StatusLegend data={data} onSelect={(b) => startList(b.name, 'Kontrak', b.items ?? [])} />
            }
          />
        </PieChart>
      </ResponsiveContainer>
      {dialog}
    </ChartFrame>
  )
}

export const CompositionBar = ({
  data,
  judul,
  ringkasan,
}: {
  data: Bucket[]
  judul: string
  ringkasan: string
}) => {
  const { startList, dialog } = useDrillDown()
  return (
    // 28px a category, so every bar keeps its label. At the fixed 224px frame Recharts
    // silently dropped every other tick, leaving ten bars sharing five names — including
    // the largest bar, which had none. The axis is sized to the longest label so short
    // categories stop spending a third of a phone's width on empty gutter.
    <ChartFrame
      judul={judul}
      ringkasan={ringkasan}
      tinggi={Math.max(224, data.length * 28)}
      legend={<BucketList data={data} onSelect={(b) => startList(b.name, 'Kontrak', b.items ?? [])} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <XAxis type="number" tick={AXIS} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tick={AXIS}
            interval={0}
            width={Math.min(120, 12 + Math.max(0, ...data.map((d) => d.name.length)) * 6)}
          />
          <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
          <Bar dataKey="value" fill="#1a5c3a" radius={[0, 4, 4, 0]} {...STILL} />
        </BarChart>
      </ResponsiveContainer>
      {dialog}
    </ChartFrame>
  )
}

export const ExpiryTimeline = ({
  data,
}: {
  data: { bulan: string; jumlah: number; items: DetailRef[] }[]
}) => {
  const { startList, dialog } = useDrillDown()
  return (
    <ChartFrame
      judul="Linimasa Berakhirnya Kontrak"
      ringkasan={data.map((d) => `${d.bulan}: ${d.jumlah} kontrak`).join('. ')}
      legend={
        <BucketList
          data={data.map((d) => ({ name: d.bulan, value: d.jumlah, items: d.items }))}
          onSelect={(b) => startList(b.name, 'Kontrak', b.items ?? [])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <XAxis dataKey="bulan" tick={AXIS} />
          <YAxis tick={AXIS} allowDecimals={false} />
          <Tooltip formatter={(value) => [`${Number(value)} kontrak`, 'Berakhir']} />
          <Bar dataKey="jumlah" fill="#2d7a52" radius={[4, 4, 0, 0]} {...STILL} />
        </BarChart>
      </ResponsiveContainer>
      {dialog}
    </ChartFrame>
  )
}

export const MarginHistogram = ({
  data,
}: {
  data: { rentang: string; jumlah: number; items: DetailRef[] }[]
}) => {
  const { startList, dialog } = useDrillDown()
  return (
    <ChartFrame
      judul="Distribusi Margin (GPM)"
      ringkasan={data.map((d) => `${d.rentang}: ${d.jumlah} kontrak`).join('. ')}
      legend={
        <BucketList
          data={data.map((d) => ({ name: d.rentang, value: d.jumlah, items: d.items }))}
          onSelect={(b) => startList(b.name, 'Kontrak', b.items ?? [])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20, right: 8 }}>
          <XAxis dataKey="rentang" tick={AXIS} />
          <YAxis tick={AXIS} allowDecimals={false} />
          <Tooltip formatter={(value) => [`${Number(value)} kontrak`, '']} />
          <Bar dataKey="jumlah" fill="#1a5c3a" radius={[4, 4, 0, 0]} {...STILL} />
        </BarChart>
      </ResponsiveContainer>
      {dialog}
    </ChartFrame>
  )
}

/**
 * Palettes for the dashboard donuts.
 *
 * Kept apart from the brand green deliberately, on the same reasoning as the semantic
 * colours in globals.css: the sidebar and the buttons own the brand green, so a green
 * sector has to mean "healthy" rather than "ours". Every slice also states its own
 * name and count in the legend, so nothing is carried by colour alone.
 */
export const RFM_COLORS: Record<string, string> = {
  HIGH: '#166534',
  MEDIUM: '#b45309',
  LOW: '#64748b',
}

export const LIFECYCLE_COLORS: Record<string, string> = {
  Aktif: '#16a34a',
  Expired: '#b91c1c',
}

export const RECEIVABLE_COLORS: Record<string, string> = {
  OPEN: '#b45309',
  CLOSED: '#16a34a',
}

const FALLBACK_COLORS = ['#1a5c3a', '#2d7a52', '#b45309', '#b91c1c', '#64748b', '#0f766e']

const colourFor = (
  name: string,
  palette: Record<string, string> | undefined,
  index: number,
): string => palette?.[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]!

/**
 * A donut with a legend that carries the numbers, not just the colours.
 *
 * The reference dashboard put the share beside every label, and it is the half of the
 * picture a sector cannot give you: two sectors of similar size are indistinguishable
 * by eye and unambiguous as "4 (44,4%)". The centre repeats the total so the
 * denominator those percentages are of is never left implicit.
 */
export const DonutCard = ({
  judul,
  keterangan,
  data,
  colors,
  satuan = 'kontrak',
  entityLabel = 'Kontrak',
}: {
  judul: string
  keterangan?: string
  data: { name: string; value: number; items: DetailRef[] }[]
  colors?: Record<string, string>
  satuan?: string
  /** Section heading in the drill-down dialog — "Kontrak" or "Pelanggan" depending on what `items` refer to. */
  entityLabel?: string
}) => {
  const { startList, dialog } = useDrillDown()
  const total = data.reduce((sum, d) => sum + d.value, 0)
  // Zero-value slices are dropped from the plot but kept in the legend: Recharts
  // renders a zero sector as a hairline that still takes a tooltip, and a band at zero
  // is worth stating in words rather than hiding entirely.
  const plotted = data.filter((d) => d.value > 0)
  const share = (value: number): string =>
    total === 0 ? '0%' : `${((value / total) * 100).toFixed(1).replace('.', ',')}%`

  return (
    <section className="card-hover rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900">{judul}</h2>
        <span className="text-xs font-semibold text-gray-500 tabular-nums">
          {total} {satuan}
        </span>
      </div>
      {keterangan ? <p className="mb-2 text-xs text-gray-500">{keterangan}</p> : null}

      <p className="sr-only-text">
        {data.map((d) => `${d.name}: ${d.value} ${satuan} (${share(d.value)})`).join('. ')}
      </p>

      <div className="relative">
        <div className="h-[180px] w-full" aria-hidden="true" inert>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={plotted}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={plotted.length > 1 ? 2 : 0}
                stroke="#fff"
                strokeWidth={2}
                {...STILL}
              >
                {plotted.map((entry, index) => (
                  <Cell key={entry.name} fill={colourFor(entry.name, colors, index)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${Number(value)} ${satuan}`, '']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Overlaid rather than drawn by Recharts, so it sits outside the inert plot
            and stays selectable text. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-gray-900 tabular-nums">{total}</span>
          <span className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">
            {satuan}
          </span>
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3">
        {data.map((d, index) => (
          <li key={d.name}>
            <button
              type="button"
              onClick={() => startList(d.name, entityLabel, d.items)}
              disabled={d.value === 0}
              className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-xs hover:bg-gray-50 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: colourFor(d.name, colors, index) }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{d.name}</span>
              <span className="shrink-0 font-bold text-gray-900 tabular-nums">{d.value}</span>
              <span className="w-14 shrink-0 text-right text-gray-500 tabular-nums">{share(d.value)}</span>
              <ChevronRight size={13} className="shrink-0 text-gray-300 group-hover:text-primary" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {dialog}
    </section>
  )
}
