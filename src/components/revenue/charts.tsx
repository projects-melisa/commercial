'use client'

import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Cell as PieCell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

import { useRevenueDrillDown } from '@/components/revenue/drill-down'
import { formatMeasure, type Measure } from '@/lib/domain'
import { DIMENSI, type DimensiKey, type RevenueRow } from '@/lib/data/revenue-pure'

/** `periode` is a plain `YYYY-MM-DD` string column with no timezone — read off the string. */
const monthOf = (row: RevenueRow): number => Number(row.periode.slice(5, 7))
const dayOf = (row: RevenueRow): number => Number(row.periode.slice(8, 10))

/**
 * A dot rendered at every point, not just on hover, so a line or area series has an
 * exact target to click — Recharts' own `activeDot` only exists while hovering, which
 * is not a target on a touch screen at all.
 */
const ClickableDot = (props: {
  cx?: number
  cy?: number
  stroke?: string
  index?: number
  onSelect: (index: number) => void
}) => {
  const { cx, cy, stroke, index, onSelect } = props
  if (cx == null || cy == null || index == null) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={stroke}
      stroke="#fff"
      strokeWidth={1.5}
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(index)
      }}
    />
  )
}

/**
 * The revenue charts.
 *
 * Deliberately plain: one axis colour, a faint grid, no gradients, no drop shadows on
 * the bars. The Power BI originals carry all three and they cost legibility — a bar
 * with a shadow reads as slightly taller than it is, which on a budget variance chart
 * is not a cosmetic problem.
 *
 * Each chart is `aria-hidden` and `inert`, and every one sits beside a real table
 * carrying the same figures. Recharts renders a pile of focusable SVG layers that
 * announce nothing, so hiding the picture and exposing the numbers is both the
 * accessible answer and the honest one.
 *
 * Do not run `pnpm format` over this file: oxfmt 0.2.0 hoists every inline comment to
 * the top of the module and detaches it from the code it explains.
 */

const AXIS = { fontSize: 11, fill: '#6b7280' }
const GRID = '#e5e7eb'

/** Actual is the brand green; last year is grey; the budget line is a dashed rule. */
const AKTUAL = '#1a5c3a'
const TAHUN_LALU = '#c7ccd4'
const RKAP = '#6b7280'

/**
 * The key, rendered here rather than by Recharts.
 *
 * Recharts colours each label with its series colour, which puts the grey 2025 swatch
 * at 1.9:1 on white. The swatch carries the colour and the label stays body grey, so
 * the text passes contrast and the mapping is still obvious. Shape is carried too —
 * a dashed rule for the budget, blocks for the actuals — so the key survives being
 * printed in black and white or read by someone who cannot separate the hues.
 */
const Kunci = ({ items }: { items: { warna: string; label: string; garis?: boolean }[] }) => (
  <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-gray-700">
    {items.map((item) => (
      <li key={item.label} className="flex items-center gap-1.5">
        {item.garis ? (
          <span
            className="h-0 w-4 border-t-2 border-dashed"
            style={{ borderColor: item.warna }}
            aria-hidden="true"
          />
        ) : (
          <span
            className="h-2.5 w-2.5 rounded-[2px]"
            style={{ background: item.warna }}
            aria-hidden="true"
          />
        )}
        {item.label}
      </li>
    ))}
  </ul>
)

/**
 * Unlike the dashboard's charts, these plot their own data points: every bar, dot and
 * slice below carries an `onClick` down to the exact `Ancillary_Data` rows behind it,
 * so the plot is a real, focusable control rather than a picture next to a table — the
 * `inert` guard the dashboard charts use does not apply here on purpose.
 */
const Frame = ({
  judul,
  keterangan,
  ringkasan,
  kunci,
  tinggi = 260,
  dialog,
  children,
}: {
  judul: string
  /** What the chart is for, said once so the reader is not left inferring it. */
  keterangan?: string
  ringkasan: string
  kunci?: { warna: string; label: string; garis?: boolean }[]
  tinggi?: number
  dialog?: React.ReactNode
  children: React.ReactNode
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
    <h2 className="text-sm font-bold text-gray-900">{judul}</h2>
    {keterangan ? <p className="mt-0.5 mb-3 text-xs text-gray-400">{keterangan}</p> : <div className="mb-4" />}
    <p className="sr-only-text">{ringkasan}</p>
    <div className="w-full" style={{ height: tinggi }}>
      {children}
    </div>
    {kunci ? <Kunci items={kunci} /> : null}
    {dialog}
  </section>
)

export interface TrenPoint {
  label: string
  rkap: number
  aktual: number
  tahunLalu: number
}

/**
 * The measure travels, not the formatter.
 *
 * A formatting function cannot cross the server/client boundary — React refuses it —
 * and duplicating the rules here would let an axis tick and a table cell describe the
 * same figure differently. Both sides call `formatMeasure`.
 */
export const TrenBulanan = ({
  data,
  rows,
  tahun,
  measure,
  judul,
}: {
  data: TrenPoint[]
  /** The source rows, so a click on one bar or dot can show exactly what sums into it. */
  rows: RevenueRow[]
  tahun: number
  measure: Measure
  judul: string
}) => {
  const format = (value: number): string => formatMeasure(measure, value)
  const { show, dialog } = useRevenueDrillDown()

  const pick = (index: number, tahunOf: number, planActual: 'Plan' | 'Actual') => {
    const bulan = index + 1
    const label = data[index]?.label ?? String(bulan)
    show(
      `${label} ${tahunOf} — ${planActual === 'Actual' ? 'Aktual' : 'RKAP'}`,
      rows.filter((r) => r.tahun === tahunOf && r.plan_actual === planActual && monthOf(r) === bulan),
    )
  }

  return (
    <Frame
      judul={judul}
      keterangan={`Batang berdampingan membandingkan bulan yang sama antar tahun; garis putus-putus adalah RKAP ${tahun}. Klik batang atau titik untuk melihat baris datanya.`}
      ringkasan={data
        .map((d) => `${d.label}: RKAP ${format(d.rkap)}, aktual ${format(d.aktual)}`)
        .join('. ')}
      kunci={[
        { warna: TAHUN_LALU, label: `Aktual ${tahun - 1}` },
        { warna: AKTUAL, label: `Aktual ${tahun}` },
        { warna: RKAP, label: `RKAP ${tahun}`, garis: true },
      ]}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
          {/* Compact ticks: a full rupiah figure here is fifteen characters and would
              squeeze the plot area into a strip. The tooltip carries the exact number. */}
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format} width={64} />
          <Tooltip
            formatter={(value, name) => [format(Number(value)), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
          <Bar
            dataKey="tahunLalu"
            name={`Aktual ${tahun - 1}`}
            fill={TAHUN_LALU}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(_, index) => pick(index, tahun - 1, 'Actual')}
          />
          <Bar
            dataKey="aktual"
            name={`Aktual ${tahun}`}
            fill={AKTUAL}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(_, index) => pick(index, tahun, 'Actual')}
          />
          <Line
            dataKey="rkap"
            name="RKAP"
            stroke={RKAP}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={<ClickableDot onSelect={(index) => pick(index, tahun, 'Plan')} />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  )
}

export interface GapPoint {
  nama: string
  diff: number
}

/**
 * Shortfall and surplus per station, diverging from zero.
 *
 * Bars leave a common baseline in both directions, so which side of budget a station
 * sits on is read first and the size second. A sorted column chart would put the same
 * information behind a comparison of lengths.
 */
export const GapCabang = ({
  data,
  rows,
  tahun,
  measure,
}: {
  data: GapPoint[]
  rows: RevenueRow[]
  tahun: number
  measure: Measure
}) => {
  const format = (value: number): string => formatMeasure(measure, value)
  const { show, dialog } = useRevenueDrillDown()

  const pick = (index: number) => {
    const point = data[index]
    if (!point) return
    show(
      `${point.nama} — RKAP vs Aktual ${tahun}`,
      rows.filter((r) => r.cab === point.nama && r.tahun === tahun),
    )
  }

  return (
    <Frame
      judul="Selisih terhadap RKAP per cabang"
      keterangan="Batang menyimpang dari nol: ke kiri berarti di bawah anggaran, ke kanan di atas. Klik batang untuk melihat baris datanya."
      ringkasan={data.map((d) => `${d.nama}: ${format(d.diff)}`).join('. ')}
      kunci={[
        { warna: '#991b1b', label: 'Di bawah RKAP' },
        { warna: '#166534', label: 'Di atas RKAP' },
      ]}
      tinggi={Math.max(200, data.length * 30 + 40)}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
        >
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis
            type="number"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            tickFormatter={format}
          />
          <YAxis
            type="category"
            dataKey="nama"
            tick={AXIS}
            axisLine={false}
            tickLine={false}
            width={64}
          />
          <Tooltip
            formatter={(value) => [format(Number(value)), 'Selisih']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
          <Bar
            dataKey="diff"
            isAnimationActive={false}
            radius={[0, 2, 2, 0]}
            cursor="pointer"
            onClick={(_, index) => pick(index)}
          >
            {data.map((point) => (
              // The semantic palette, not the brand green: this bar says "good" or
              // "bad", and the brand colour belongs to buttons and navigation.
              <Cell key={point.nama} fill={point.diff < 0 ? '#991b1b' : '#166534'} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  )
}

// ── Cumulative pace ─────────────────────────────────────────────────────────────

/**
 * Running totals, which is where a widening gap becomes visible.
 *
 * The monthly bars show each month against its own budget and a run of near-misses
 * reads as unremarkable. Stacked up, the same run is a canyon — and the distance
 * between the two lines is the number that has to be closed before December.
 */
export const TrenKumulatif = ({
  data,
  rows,
  tahun,
  measure,
}: {
  data: TrenPoint[]
  rows: RevenueRow[]
  tahun: number
  measure: Measure
}) => {
  const format = (value: number): string => formatMeasure(measure, value)
  const { show, dialog } = useRevenueDrillDown()

  const pick = (index: number, tahunOf: number, planActual: 'Plan' | 'Actual') => {
    const bulanAkhir = index + 1
    const label = data[index]?.label ?? String(bulanAkhir)
    show(
      `s.d. ${label} ${tahunOf} — ${planActual === 'Actual' ? 'Aktual' : 'RKAP'} (akumulasi)`,
      rows.filter((r) => r.tahun === tahunOf && r.plan_actual === planActual && monthOf(r) <= bulanAkhir),
    )
  }

  return (
    <Frame
      judul={`Akumulasi terhadap RKAP ${tahun}`}
      keterangan="Jarak vertikal antara dua garis adalah selisih yang harus dikejar sampai Desember. Klik titik untuk melihat baris datanya sampai bulan itu."
      ringkasan={data
        .filter((d) => Number.isFinite(d.aktual))
        .map((d) => `sampai ${d.label}: aktual ${format(d.aktual)} dari RKAP ${format(d.rkap)}`)
        .join('. ')}
      kunci={[
        { warna: AKTUAL, label: `Akumulasi aktual ${tahun}` },
        { warna: TAHUN_LALU, label: `Akumulasi aktual ${tahun - 1}` },
        { warna: RKAP, label: `Akumulasi RKAP ${tahun}`, garis: true },
      ]}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format} width={64} />
          <Tooltip
            formatter={(value, name) => [format(Number(value)), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
          <Area
            dataKey="aktual"
            name={`Akumulasi aktual ${tahun}`}
            stroke={AKTUAL}
            strokeWidth={2}
            fill={AKTUAL}
            fillOpacity={0.12}
            // Months with no actual yet are NaN rather than zero; connecting across
            // them would draw a confident flat line through data that does not exist.
            connectNulls={false}
            dot={<ClickableDot onSelect={(index) => pick(index, tahun, 'Actual')} />}
            isAnimationActive={false}
          />
          <Line
            dataKey="tahunLalu"
            name={`Akumulasi aktual ${tahun - 1}`}
            stroke={TAHUN_LALU}
            strokeWidth={2}
            dot={<ClickableDot onSelect={(index) => pick(index, tahun - 1, 'Actual')} />}
            isAnimationActive={false}
          />
          <Line
            dataKey="rkap"
            name={`Akumulasi RKAP ${tahun}`}
            stroke={RKAP}
            strokeWidth={1.5}
            strokeDasharray="5 3"
            dot={<ClickableDot onSelect={(index) => pick(index, tahun, 'Plan')} />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  )
}

// ── Composition ─────────────────────────────────────────────────────────────────

const PALET = ['#1a5c3a', '#2d7a52', '#4f9d73', '#7cbd9a', '#a9d6c0', '#c7ccd4']

export interface BagianPoint {
  nama: string
  nilai: number
  porsi: number
}

/**
 * What the book is made of, as one stacked bar rather than a pie.
 *
 * A single bar puts every share on a common baseline, so two slices can actually be
 * compared. Pie sectors cannot be — the eye reads angle badly, and the two smallest
 * lines here are the ones a portfolio conversation is usually about.
 */
export const Komposisi = ({
  data,
  rows,
  tahun,
  dimensiKey,
  measure,
  judul,
}: {
  data: BagianPoint[]
  rows: RevenueRow[]
  tahun: number
  /** The same `DIMENSI` key `komposisi()` was built with — see `Ranking`'s `dimensiKey`. */
  dimensiKey: DimensiKey
  measure: Measure
  judul: string
}) => {
  const format = (value: number): string => formatMeasure(measure, value)
  const row = Object.fromEntries(data.map((d) => [d.nama, d.nilai]))
  const { show, dialog } = useRevenueDrillDown()
  const keyFn = DIMENSI[dimensiKey]

  const pick = (nama: string) => {
    show(
      `${nama} — aktual ${tahun}`,
      rows.filter((r) => r.tahun === tahun && r.plan_actual === 'Actual' && (keyFn(r) ?? '(tanpa keterangan)') === nama),
    )
  }

  return (
    <Frame
      judul={judul}
      keterangan="Satu batang, dibagi menurut porsi masing-masing terhadap total aktual. Klik satu bagian untuk melihat baris datanya."
      ringkasan={data
        .map((d) => `${d.nama}: ${format(d.nilai)}, ${(d.porsi * 100).toFixed(1)} persen`)
        .join('. ')}
      kunci={data.map((d, i) => ({ warna: PALET[i % PALET.length]!, label: d.nama }))}
      tinggi={110}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={[row]}
          layout="vertical"
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <XAxis type="number" hide />
          <YAxis type="category" hide />
          <Tooltip
            formatter={(value, name) => [format(Number(value)), String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
          {data.map((d, i) => (
            <Bar
              key={d.nama}
              dataKey={d.nama}
              stackId="a"
              fill={PALET[i % PALET.length]}
              isAnimationActive={false}
              cursor="pointer"
              onClick={() => pick(d.nama)}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  )
}

// ── RFM ─────────────────────────────────────────────────────────────────────────

export interface RfmPoint {
  nama: string
  frequency: number
  monetary: number
  recency: number
  rfm: string
  pendapatan: number
}

const RFM_WARNA: Record<string, string> = {
  HIGH: '#166534',
  MEDIUM: '#92400e',
  LOW: '#991b1b',
}

/**
 * Frequency against monetary, with recency as the dot size.
 *
 * Three scores on two axes plus one radius, which is the whole of RFM in one picture:
 * top-right and large is a customer worth keeping, top-right and small is one who used
 * to be. A bar chart of the RFM label alone loses exactly that distinction — the one
 * that decides who gets a call this quarter.
 */
export const RfmSebaran = ({
  data,
  rows,
  tahun,
}: {
  data: RfmPoint[]
  /** The source rows, so a click on one customer's dot shows their actual rows for the year. */
  rows: RevenueRow[]
  tahun: number
}) => {
  const { show, dialog } = useRevenueDrillDown()

  const pick = (point: { payload?: RfmPoint } & Partial<RfmPoint>) => {
    const nama = point.payload?.nama ?? point.nama
    if (!nama) return
    show(
      `${nama} — Aktual ${tahun}`,
      rows.filter((r) => r.customer === nama && r.tahun === tahun && r.plan_actual === 'Actual'),
    )
  }

  return (
    <Frame
      judul="Sebaran RFM"
      keterangan="Sumbu mendatar frequency, tegak monetary, besar titik recency. Kanan-atas dan besar = pelanggan aktif bernilai tinggi. Klik satu titik untuk melihat baris datanya."
      ringkasan={data
        .map((d) => `${d.nama}: ${d.rfm}, F${d.frequency} M${d.monetary} R${d.recency}`)
        .join('. ')}
      kunci={Object.entries(RFM_WARNA).map(([label, warna]) => ({ warna, label }))}
      tinggi={300}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 8 }}>
          <CartesianGrid stroke={GRID} />
          <XAxis
            type="number"
            dataKey="frequency"
            name="Frequency"
            domain={[0, 4]}
            ticks={[1, 2, 3]}
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            type="number"
            dataKey="monetary"
            name="Monetary"
            domain={[0, 4]}
            ticks={[1, 2, 3]}
            tick={AXIS}
            axisLine={false}
            tickLine={false}
          />
          <ZAxis type="number" dataKey="recency" range={[80, 420]} name="Recency" />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
            formatter={(value, name) => [String(value), String(name)]}
          />
          {Object.keys(RFM_WARNA).map((status) => (
            <Scatter
              key={status}
              name={status}
              data={data.filter((d) => d.rfm === status)}
              fill={RFM_WARNA[status]}
              isAnimationActive={false}
              cursor="pointer"
              onClick={pick}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </Frame>
  )
}

// ── Classification ──────────────────────────────────────────────────────────────

export interface IrisanPoint {
  nama: string
  jumlah: number
  warna: string
  /** Names of the customers folded into this slice, so a click can show their rows. */
  customers: string[]
}

/**
 * A ring and a bar of the same counts, side by side — which is what the client's own
 * tracker draws, and for a good reason.
 *
 * The ring answers "what is the shape of the book" and the bar answers "which band is
 * biggest, exactly". A ring alone cannot do the second: the eye reads angle badly, and
 * two bands within a few percent of each other look identical in a donut and obviously
 * different in a bar. Each slice is labelled with its count and share so neither chart
 * has to be measured by eye at all.
 */
export const KlasifikasiCincin = ({
  data,
  rows,
  tahun,
  judul,
  keterangan,
}: {
  data: IrisanPoint[]
  /** The source rows, so a click on one slice can show the rows behind its customers. */
  rows: RevenueRow[]
  tahun: number
  judul: string
  keterangan?: string
}) => {
  const total = data.reduce((sum, d) => sum + d.jumlah, 0)
  const { show, dialog } = useRevenueDrillDown()

  const pick = (index: number) => {
    const slice = data[index]
    if (!slice) return
    const names = new Set(slice.customers)
    show(
      `${slice.nama} — Aktual ${tahun}`,
      rows.filter((r) => names.has(r.customer) && r.tahun === tahun && r.plan_actual === 'Actual'),
    )
  }

  return (
    <Frame
      judul={judul}
      keterangan={keterangan ? `${keterangan} Klik satu irisan untuk melihat baris datanya.` : undefined}
      ringkasan={data
        .map(
          (d) =>
            `${d.nama}: ${d.jumlah} pelanggan, ${total === 0 ? 0 : ((d.jumlah / total) * 100).toFixed(2)} persen`,
        )
        .join('. ')}
      kunci={data.map((d) => ({ warna: d.warna, label: `${d.nama} — ${d.jumlah}` }))}
      tinggi={240}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="jumlah"
            nameKey="nama"
            innerRadius={55}
            outerRadius={90}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(_, index) => pick(index)}
            // The count and share printed on the slice, so the ring never has to be
            // measured by eye — the one thing a donut is genuinely bad at.
            label={(props: { value?: number | string }) => {
              const nilai = Number(props.value ?? 0)
              return total === 0 ? '' : `${nilai} (${((nilai / total) * 100).toFixed(2)}%)`
            }}
            labelLine={false}
          >
            {data.map((d) => (
              <PieCell key={d.nama} fill={d.warna} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [`${Number(value)} pelanggan`, String(name)]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
        </PieChart>
      </ResponsiveContainer>
    </Frame>
  )
}

/** The same counts as horizontal bars, where a two-point difference is actually visible. */
export const KlasifikasiBatang = ({
  data,
  rows,
  tahun,
  judul,
  keterangan,
}: {
  data: IrisanPoint[]
  rows: RevenueRow[]
  tahun: number
  judul: string
  keterangan?: string
}) => {
  const { show, dialog } = useRevenueDrillDown()

  const pick = (index: number) => {
    const bar = data[index]
    if (!bar) return
    const names = new Set(bar.customers)
    show(
      `${bar.nama} — Aktual ${tahun}`,
      rows.filter((r) => names.has(r.customer) && r.tahun === tahun && r.plan_actual === 'Actual'),
    )
  }

  return (
    <Frame
      judul={judul}
      keterangan={keterangan ? `${keterangan} Klik satu batang untuk melihat baris datanya.` : undefined}
      ringkasan={data.map((d) => `${d.nama}: ${d.jumlah}`).join('. ')}
      kunci={data.map((d) => ({ warna: d.warna, label: d.nama }))}
      tinggi={Math.max(180, data.length * 44 + 40)}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} layout="vertical" margin={{ top: 4, right: 32, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} horizontal={false} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="nama" tick={AXIS} axisLine={false} tickLine={false} width={72} />
          <Tooltip
            formatter={(value) => [`${Number(value)} pelanggan`, 'Jumlah']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
          <Bar
            dataKey="jumlah"
            isAnimationActive={false}
            radius={[0, 2, 2, 0]}
            label={{ position: 'right', fontSize: 11, fill: '#374151' }}
            cursor="pointer"
            onClick={(_, index) => pick(index)}
          >
            {data.map((d) => (
              <Cell key={d.nama} fill={d.warna} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  )
}

// ── Daily rhythm ────────────────────────────────────────────────────────────────

export interface HarianPoint {
  hari: number
  aktual: number
  tahunLalu: number
}

/**
 * Day of month, summed across the year — the month's internal rhythm.
 *
 * Last year is the filled area behind, this year the line in front, so the comparison
 * is read as "are we above or below the same day last year" rather than as two shapes
 * to be matched up. Both series are on one axis because they are the same measure.
 */
export const TrenHarian = ({
  data,
  rows,
  tahun,
  measure,
}: {
  data: HarianPoint[]
  rows: RevenueRow[]
  tahun: number
  measure: Measure
}) => {
  const format = (value: number): string => formatMeasure(measure, value)
  const { show, dialog } = useRevenueDrillDown()

  const pick = (index: number, tahunOf: number) => {
    const hari = data[index]?.hari ?? index + 1
    show(
      `Hari ke-${hari} — Aktual ${tahunOf}`,
      rows.filter((r) => r.tahun === tahunOf && r.plan_actual === 'Actual' && dayOf(r) === hari),
    )
  }

  return (
    <Frame
      judul={`Tren harian — hari ke-1 sampai ke-31`}
      keterangan="Dijumlahkan lintas bulan. Hari ke-29 sampai 31 mencakup lebih sedikit bulan, jadi wajar lebih rendah. Klik titik untuk melihat baris datanya."
      ringkasan={data
        .map((d) => `hari ${d.hari}: ${format(d.aktual)}`)
        .join('. ')}
      kunci={[
        { warna: TAHUN_LALU, label: `Aktual ${tahun - 1}` },
        { warna: AKTUAL, label: `Aktual ${tahun}` },
      ]}
      dialog={dialog}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="hari"
            tick={AXIS}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            interval={1}
          />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format} width={64} />
          <Tooltip
            formatter={(value, name) => [format(Number(value)), String(name)]}
            labelFormatter={(label) => `Hari ke-${label}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${GRID}` }}
          />
          <Area
            dataKey="tahunLalu"
            name={`Aktual ${tahun - 1}`}
            stroke={TAHUN_LALU}
            strokeWidth={1}
            fill={TAHUN_LALU}
            fillOpacity={0.55}
            dot={<ClickableDot onSelect={(index) => pick(index, tahun - 1)} />}
            isAnimationActive={false}
          />
          <Line
            dataKey="aktual"
            name={`Aktual ${tahun}`}
            stroke={AKTUAL}
            strokeWidth={2}
            dot={<ClickableDot onSelect={(index) => pick(index, tahun)} />}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Frame>
  )
}
